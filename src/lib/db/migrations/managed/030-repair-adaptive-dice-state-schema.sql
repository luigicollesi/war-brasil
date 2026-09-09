-- Migration 030: repair legacy player_dice_states left untouched by migration 029.
-- Migration 029 uses CREATE TABLE IF NOT EXISTS, so an older table with the same
-- name can survive without the match-scoped adaptive-dice columns.
--
-- The legacy shape cannot be converted safely when it contains state because
-- pressure/roll_count used different semantics. Refuse that case instead of
-- silently discarding or guessing data.

-- Up Migration

DO $$
DECLARE
  has_match_id BOOLEAN;
  has_batch_count BOOLEAN;
  has_roll_count BOOLEAN;
BEGIN
  IF to_regclass('game.player_dice_states') IS NULL THEN
    RETURN;
  END IF;

  SELECT
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'game'
        AND table_name = 'player_dice_states'
        AND column_name = 'match_id'
    ),
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'game'
        AND table_name = 'player_dice_states'
        AND column_name = 'batch_count'
    ),
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'game'
        AND table_name = 'player_dice_states'
        AND column_name = 'roll_count'
    )
  INTO has_match_id, has_batch_count, has_roll_count;

  IF NOT has_match_id AND NOT has_batch_count AND has_roll_count THEN
    LOCK TABLE game.player_dice_states IN ACCESS EXCLUSIVE MODE;

    IF EXISTS (SELECT 1 FROM game.player_dice_states LIMIT 1) THEN
      RAISE EXCEPTION
        'Cannot repair legacy game.player_dice_states automatically because it contains rows';
    END IF;

    DROP TABLE game.player_dice_states;
  ELSIF NOT (has_match_id AND has_batch_count AND NOT has_roll_count) THEN
    RAISE EXCEPTION
      'game.player_dice_states has an unexpected intermediate schema';
  END IF;
END
$$;

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

DO $$
DECLARE
  actual_columns TEXT[];
  primary_key_columns TEXT[];
BEGIN
  SELECT array_agg(
           column_name || ':' || udt_name || ':' || is_nullable
           ORDER BY ordinal_position
         )
    INTO actual_columns
    FROM information_schema.columns
   WHERE table_schema = 'game'
     AND table_name = 'player_dice_states';

  IF actual_columns IS DISTINCT FROM ARRAY[
    'match_id:int8:NO',
    'player_id:int8:NO',
    'pressure:float8:NO',
    'batch_count:int4:NO',
    'last_roll_round:int4:YES',
    'created_at:timestamptz:NO',
    'updated_at:timestamptz:NO'
  ]::TEXT[] THEN
    RAISE EXCEPTION
      'game.player_dice_states columns do not match adaptive-dice schema: %',
      actual_columns;
  END IF;

  SELECT array_agg(att.attname ORDER BY key_column.ordinality)
    INTO primary_key_columns
    FROM pg_constraint con
    CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS key_column(attnum, ordinality)
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = key_column.attnum
   WHERE con.conrelid = 'game.player_dice_states'::regclass
     AND con.contype = 'p';

  IF primary_key_columns IS DISTINCT FROM ARRAY['match_id', 'player_id']::TEXT[] THEN
    RAISE EXCEPTION
      'game.player_dice_states primary key is unexpected: %',
      primary_key_columns;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = 'game.player_dice_states'::regclass
      AND con.conname = 'player_dice_states_match_id_fkey'
      AND con.confrelid = 'game.matches'::regclass
      AND con.confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'game.player_dice_states match foreign key is missing or incompatible';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = 'game.player_dice_states'::regclass
      AND con.conname = 'player_dice_states_player_id_fkey'
      AND con.confrelid = 'game.players'::regclass
      AND con.confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'game.player_dice_states player foreign key is missing or incompatible';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = 'game.player_dice_states'::regclass
      AND con.conname = 'player_dice_states_pressure_check'
      AND con.contype = 'c'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = 'game.player_dice_states'::regclass
      AND con.conname = 'player_dice_states_batch_count_check'
      AND con.contype = 'c'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = 'game.player_dice_states'::regclass
      AND con.conname = 'player_dice_states_last_roll_round_check'
      AND con.contype = 'c'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = 'game.player_dice_states'::regclass
      AND con.conname = 'player_dice_states_batch_history_check'
      AND con.contype = 'c'
  ) THEN
    RAISE EXCEPTION 'game.player_dice_states adaptive-dice checks are incomplete';
  END IF;
END
$$;
