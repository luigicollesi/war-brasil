-- Migration 029: add match-scoped adaptive combat dice balancing.
-- Requires the normalized schema state introduced by migrations 026-028.
-- Existing in-progress games are pinned to uniform-v1 so a deploy never changes
-- their combat RNG mid-match. New games resolve the configured default profile.
--
-- This migration is also safe when the clean-install schema already contains
-- the final objects: CREATE IF NOT EXISTS is followed by semantic validation so
-- an incompatible pre-existing object is rejected instead of silently accepted.

-- Up Migration

CREATE TABLE IF NOT EXISTS catalog.dice_balance_profiles (
  id TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL
    CONSTRAINT dice_balance_profiles_algorithm_check
      CHECK (algorithm IN ('uniform', 'adaptive_halves')),
  alpha DOUBLE PRECISION NOT NULL,
  pressure_cap DOUBLE PRECISION NOT NULL,
  dead_zone DOUBLE PRECISION NOT NULL,
  retention_per_round DOUBLE PRECISION NOT NULL,
  max_group_shift DOUBLE PRECISION NOT NULL,
  inner_tilt DOUBLE PRECISION NOT NULL,
  min_face_probability DOUBLE PRECISION NOT NULL,
  max_face_probability DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dice_balance_profiles_probability_range_check CHECK (
    min_face_probability > 0
    AND max_face_probability < 1
    AND min_face_probability <= max_face_probability
  ),
  CONSTRAINT dice_balance_profiles_algorithm_parameters_check CHECK (
    (
      algorithm = 'uniform'
      AND alpha = 0
      AND pressure_cap = 0
      AND dead_zone = 0
      AND retention_per_round = 1
      AND max_group_shift = 0
      AND inner_tilt = 0
    )
    OR
    (
      algorithm = 'adaptive_halves'
      AND alpha > 0 AND alpha <= 1
      AND pressure_cap > 0 AND pressure_cap <= 1
      AND dead_zone >= 0 AND dead_zone < pressure_cap
      AND retention_per_round > 0 AND retention_per_round <= 1
      AND max_group_shift > 0 AND max_group_shift < 0.5
      AND inner_tilt >= 0 AND inner_tilt < (1.0 / 3.0)
    )
  )
);

INSERT INTO catalog.dice_balance_profiles (
  id, algorithm, alpha, pressure_cap, dead_zone, retention_per_round,
  max_group_shift, inner_tilt, min_face_probability, max_face_probability
) VALUES
  (
    'uniform-v1', 'uniform', 0, 0, 0, 1,
    0, 0, (1.0 / 6.0), (1.0 / 6.0)
  ),
  (
    'adaptive-halves-v1', 'adaptive_halves', 0.12, 0.60, 0.10, 0.80,
    0.20, 0.03, 0.09, 0.27
  )
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  uniform_row RECORD;
  adaptive_row RECORD;
BEGIN
  SELECT * INTO uniform_row
  FROM catalog.dice_balance_profiles
  WHERE id = 'uniform-v1';

  IF uniform_row IS NULL
     OR uniform_row.algorithm <> 'uniform'
     OR uniform_row.alpha <> 0
     OR uniform_row.pressure_cap <> 0
     OR uniform_row.dead_zone <> 0
     OR uniform_row.retention_per_round <> 1
     OR uniform_row.max_group_shift <> 0
     OR uniform_row.inner_tilt <> 0
     OR abs(uniform_row.min_face_probability - (1.0 / 6.0)) > 1e-12
     OR abs(uniform_row.max_face_probability - (1.0 / 6.0)) > 1e-12 THEN
    RAISE EXCEPTION 'catalog.dice_balance_profiles uniform-v1 has unexpected semantics';
  END IF;

  SELECT * INTO adaptive_row
  FROM catalog.dice_balance_profiles
  WHERE id = 'adaptive-halves-v1';

  IF adaptive_row IS NULL
     OR adaptive_row.algorithm <> 'adaptive_halves'
     OR adaptive_row.alpha <> 0.12
     OR adaptive_row.pressure_cap <> 0.60
     OR adaptive_row.dead_zone <> 0.10
     OR adaptive_row.retention_per_round <> 0.80
     OR adaptive_row.max_group_shift <> 0.20
     OR adaptive_row.inner_tilt <> 0.03
     OR adaptive_row.min_face_probability <> 0.09
     OR adaptive_row.max_face_probability <> 0.27 THEN
    RAISE EXCEPTION 'catalog.dice_balance_profiles adaptive-halves-v1 has unexpected semantics';
  END IF;
END
$$;

COMMENT ON TABLE catalog.dice_balance_profiles IS
  'Append-only versioned parameter sets for server-authoritative combat dice generation.';

CREATE TABLE IF NOT EXISTS catalog.dice_balance_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1
    CONSTRAINT dice_balance_settings_singleton_check CHECK (id = 1),
  default_profile_id TEXT NOT NULL
    CONSTRAINT dice_balance_settings_default_profile_fkey
      REFERENCES catalog.dice_balance_profiles(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO catalog.dice_balance_settings (id, default_profile_id)
VALUES (1, 'adaptive-halves-v1')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE catalog.dice_balance_settings IS
  'Singleton operational setting selecting the profile used by newly started matches.';

CREATE OR REPLACE FUNCTION catalog.reject_dice_balance_profile_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'dice balance profiles are append-only; create a new profile version instead';
END;
$$;

DROP TRIGGER IF EXISTS dice_balance_profiles_append_only
  ON catalog.dice_balance_profiles;
CREATE TRIGGER dice_balance_profiles_append_only
BEFORE UPDATE OR DELETE ON catalog.dice_balance_profiles
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_dice_balance_profile_mutation();

CREATE TABLE IF NOT EXISTS game.matches (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL
    CONSTRAINT matches_room_id_fkey
      REFERENCES game.rooms(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL
    CONSTRAINT matches_sequence_check CHECK (sequence >= 1),
  requested_profile_id TEXT
    CONSTRAINT matches_requested_profile_fkey
      REFERENCES catalog.dice_balance_profiles(id) ON DELETE RESTRICT,
  resolved_profile_id TEXT NOT NULL,
  profile_source TEXT NOT NULL
    CONSTRAINT matches_profile_source_check
      CHECK (profile_source IN ('catalog', 'builtin_fallback')),
  dice_balance_profile_snapshot JSONB NOT NULL
    CONSTRAINT matches_profile_snapshot_object_check
      CHECK (jsonb_typeof(dice_balance_profile_snapshot) = 'object'),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  CONSTRAINT matches_room_sequence_key UNIQUE (room_id, sequence),
  CONSTRAINT matches_room_id_id_key UNIQUE (room_id, id),
  CONSTRAINT matches_profile_resolution_check CHECK (
    (
      profile_source = 'catalog'
      AND requested_profile_id IS NOT NULL
      AND resolved_profile_id = requested_profile_id
    )
    OR
    (
      profile_source = 'builtin_fallback'
      AND resolved_profile_id = 'builtin-uniform-v1'
    )
  ),
  CONSTRAINT matches_finished_at_check
    CHECK (finished_at IS NULL OR finished_at >= started_at)
);

COMMENT ON TABLE game.matches IS
  'One game execution inside a room for RNG lifecycle/versioning. Other runtime artifacts remain room-scoped.';

COMMENT ON COLUMN game.matches.dice_balance_profile_snapshot IS
  'Validated immutable combat-dice profile used for the complete lifetime of this match.';

CREATE OR REPLACE FUNCTION game.reject_match_dice_profile_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'match dice profile fields are immutable after match creation';
END;
$$;

DROP TRIGGER IF EXISTS matches_dice_profile_immutable ON game.matches;
CREATE TRIGGER matches_dice_profile_immutable
BEFORE UPDATE OF requested_profile_id,resolved_profile_id,profile_source,dice_balance_profile_snapshot
ON game.matches
FOR EACH ROW
EXECUTE FUNCTION game.reject_match_dice_profile_mutation();

ALTER TABLE game.rooms
  ADD COLUMN IF NOT EXISTS current_match_id BIGINT;

DO $$
DECLARE
  current_definition TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO current_definition
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'game'
     AND t.relname = 'rooms'
     AND c.conname = 'rooms_current_match_fkey';

  IF current_definition IS NULL THEN
    ALTER TABLE game.rooms
      ADD CONSTRAINT rooms_current_match_fkey
      FOREIGN KEY (id, current_match_id)
      REFERENCES game.matches(room_id, id)
      ON DELETE SET NULL (current_match_id);
  ELSIF current_definition NOT LIKE '%FOREIGN KEY (id, current_match_id)%'
     OR current_definition NOT LIKE '%REFERENCES game.matches(room_id, id)%'
     OR current_definition NOT LIKE '%ON DELETE SET NULL (current_match_id)%' THEN
    RAISE EXCEPTION
      'Constraint game.rooms.rooms_current_match_fkey has unexpected semantics: %',
      current_definition;
  END IF;
END
$$;

-- Views created by migration 026 expand SELECT * at creation time. Recreate the
-- compatibility view after adding current_match_id so upgraded and clean schemas
-- expose the same room shape.
CREATE OR REPLACE VIEW public.game_rooms AS SELECT * FROM game.rooms;

CREATE TABLE IF NOT EXISTS game.player_dice_states (
  match_id BIGINT NOT NULL
    CONSTRAINT player_dice_states_match_id_fkey
      REFERENCES game.matches(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL
    CONSTRAINT player_dice_states_player_id_fkey
      REFERENCES game.players(id) ON DELETE CASCADE,
  pressure DOUBLE PRECISION NOT NULL DEFAULT 0
    CONSTRAINT player_dice_states_pressure_check
      CHECK (pressure BETWEEN -1.0 AND 1.0),
  batch_count INTEGER NOT NULL DEFAULT 0
    CONSTRAINT player_dice_states_batch_count_check CHECK (batch_count >= 0),
  last_roll_round INTEGER
    CONSTRAINT player_dice_states_last_roll_round_check
      CHECK (last_roll_round IS NULL OR last_roll_round >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_dice_states_pkey PRIMARY KEY (match_id, player_id),
  CONSTRAINT player_dice_states_batch_history_check CHECK (
    (batch_count = 0 AND last_roll_round IS NULL)
    OR (batch_count > 0 AND last_roll_round IS NOT NULL)
  )
);

COMMENT ON TABLE game.player_dice_states IS
  'Adaptive combat-dice state scoped to one match and one player.';

-- Preserve games already running when this feature is deployed. They used fair
-- dice before migration 029, so their first explicit match remains uniform.
WITH legacy_rooms AS (
  SELECT
    room.id AS room_id,
    room.status,
    COALESCE(room.started_at, room.created_at, NOW()) AS match_started_at,
    COALESCE(
      (SELECT MAX(existing.sequence) FROM game.matches existing WHERE existing.room_id = room.id),
      0
    ) + 1 AS next_sequence
  FROM game.rooms room
  WHERE room.status IN ('order_roll', 'playing', 'finished')
    AND (
      (room.status IN ('order_roll', 'playing') AND room.current_match_id IS NULL)
      OR
      (
        room.status = 'finished'
        AND NOT EXISTS (
          SELECT 1 FROM game.matches existing WHERE existing.room_id = room.id
        )
      )
    )
), inserted AS (
  INSERT INTO game.matches (
    room_id, sequence, requested_profile_id, resolved_profile_id,
    profile_source, dice_balance_profile_snapshot, started_at, finished_at
  )
  SELECT
    room_id,
    next_sequence,
    'uniform-v1',
    'uniform-v1',
    'catalog',
    jsonb_build_object(
      'algorithm', 'uniform',
      'alpha', 0,
      'pressureCap', 0,
      'deadZone', 0,
      'retentionPerRound', 1,
      'maxGroupShift', 0,
      'innerTilt', 0,
      'minFaceProbability', (1.0 / 6.0),
      'maxFaceProbability', (1.0 / 6.0)
    ),
    match_started_at,
    CASE WHEN status = 'finished' THEN NOW() ELSE NULL END
  FROM legacy_rooms
  RETURNING id, room_id, finished_at
)
UPDATE game.rooms room
SET current_match_id = inserted.id
FROM inserted
WHERE room.id = inserted.room_id
  AND inserted.finished_at IS NULL;

DO $$
DECLARE
  missing TEXT[];
BEGIN
  WITH expected(schema_name, table_name) AS (
    VALUES
      ('catalog', 'dice_balance_profiles'),
      ('catalog', 'dice_balance_settings'),
      ('game', 'matches'),
      ('game', 'player_dice_states')
  )
  SELECT COALESCE(
    array_agg(expected.schema_name || '.' || expected.table_name)
      FILTER (WHERE c.oid IS NULL),
    ARRAY[]::text[]
  )
  INTO missing
  FROM expected
  LEFT JOIN pg_namespace n ON n.nspname = expected.schema_name
  LEFT JOIN pg_class c
    ON c.relnamespace = n.oid
   AND c.relname = expected.table_name
   AND c.relkind IN ('r', 'p');

  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Adaptive dice schema incomplete after migration 029: %', missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'game'
      AND table_name = 'rooms'
      AND column_name = 'current_match_id'
  ) THEN
    RAISE EXCEPTION 'Adaptive dice schema incomplete: game.rooms.current_match_id is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'game_rooms'
      AND column_name = 'current_match_id'
  ) THEN
    RAISE EXCEPTION 'Adaptive dice schema incomplete: public.game_rooms is not aligned with game.rooms';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'catalog.dice_balance_profiles'::regclass
      AND tgname = 'dice_balance_profiles_append_only'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Adaptive dice schema incomplete: append-only profile trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'game.matches'::regclass
      AND tgname = 'matches_dice_profile_immutable'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Adaptive dice schema incomplete: immutable match profile trigger is missing';
  END IF;
END
$$;
