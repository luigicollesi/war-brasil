-- Passe de Campanha V1: seasonal progression foundation and match snapshots.
-- This migration intentionally does not activate/seed a season: XP thresholds,
-- seasonal cosmetic ids/assets and the first campaign window remain content decisions.
--
-- Up Migration

CREATE SCHEMA IF NOT EXISTS progression;

CREATE TABLE IF NOT EXISTS catalog.battle_pass_xp_profiles (
  id TEXT PRIMARY KEY,
  completion_xp INTEGER NOT NULL CHECK (completion_xp >= 0),
  victory_bonus_xp INTEGER NOT NULL CHECK (victory_bonus_xp >= 0),
  solo_human_bot_multiplier_bps INTEGER NOT NULL DEFAULT 10000
    CHECK (solo_human_bot_multiplier_bps BETWEEN 0 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (btrim(id) <> ''),
  CHECK (completion_xp + victory_bonus_xp > 0)
);

CREATE TABLE IF NOT EXISTS catalog.battle_pass_seasons (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name VARCHAR(96) NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  claim_ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','announced','active','ended','archived')),
  max_level SMALLINT NOT NULL DEFAULT 100 CHECK (max_level = 100),
  xp_profile_id TEXT NOT NULL
    REFERENCES catalog.battle_pass_xp_profiles(id) ON DELETE RESTRICT,
  hero_asset_ref TEXT,
  logo_asset_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (btrim(id) <> ''),
  CHECK (btrim(slug) <> ''),
  CHECK (btrim(name) <> ''),
  CHECK (description IS NULL OR btrim(description) <> ''),
  CHECK (ends_at > starts_at),
  CHECK (claim_ends_at >= ends_at),
  CHECK (hero_asset_ref IS NULL OR btrim(hero_asset_ref) <> ''),
  CHECK (logo_asset_ref IS NULL OR btrim(logo_asset_ref) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS battle_pass_seasons_single_active_uidx
  ON catalog.battle_pass_seasons ((status))
  WHERE status='active';

CREATE INDEX IF NOT EXISTS battle_pass_seasons_window_idx
  ON catalog.battle_pass_seasons(status,starts_at,ends_at);

CREATE TABLE IF NOT EXISTS catalog.battle_pass_levels (
  season_id TEXT NOT NULL
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 100),
  required_total_xp BIGINT NOT NULL CHECK (required_total_xp >= 0),
  PRIMARY KEY (season_id,level),
  UNIQUE (season_id,required_total_xp)
);

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_level_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM catalog.battle_pass_levels previous
     WHERE previous.season_id=NEW.season_id
       AND previous.level < NEW.level
       AND previous.required_total_xp >= NEW.required_total_xp
  ) THEN
    RAISE EXCEPTION 'battle pass XP thresholds must increase with level';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM catalog.battle_pass_levels following
     WHERE following.season_id=NEW.season_id
       AND following.level > NEW.level
       AND following.required_total_xp <= NEW.required_total_xp
  ) THEN
    RAISE EXCEPTION 'battle pass XP thresholds must increase with level';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_levels_threshold_guard
  ON catalog.battle_pass_levels;
CREATE TRIGGER battle_pass_levels_threshold_guard
BEFORE INSERT OR UPDATE OF level,required_total_xp,season_id
ON catalog.battle_pass_levels
FOR EACH ROW EXECUTE FUNCTION catalog.validate_battle_pass_level_threshold();

CREATE TABLE IF NOT EXISTS catalog.battle_pass_rewards (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  level SMALLINT NOT NULL,
  track VARCHAR(16) NOT NULL CHECK (track IN ('free','premium')),
  position SMALLINT NOT NULL DEFAULT 0 CHECK (position >= 0),
  reward_kind VARCHAR(32) NOT NULL
    CHECK (reward_kind IN (
      'campaign_credit',
      'game_cosmetic',
      'commander_title',
      'profile_background'
    )),
  credit_amount BIGINT,
  cosmetic_id TEXT REFERENCES catalog.cosmetics(id) ON DELETE RESTRICT,
  title_id TEXT REFERENCES catalog.commander_titles(id) ON DELETE RESTRICT,
  background_id TEXT REFERENCES catalog.profile_backgrounds(id) ON DELETE RESTRICT,
  presentation_group_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT battle_pass_rewards_level_fkey
    FOREIGN KEY (season_id,level)
    REFERENCES catalog.battle_pass_levels(season_id,level)
    ON DELETE CASCADE,
  CONSTRAINT battle_pass_rewards_position_key
    UNIQUE (season_id,level,track,position),
  CONSTRAINT battle_pass_rewards_id_season_key
    UNIQUE (id,season_id),
  CONSTRAINT battle_pass_rewards_payload_check CHECK (
    (
      reward_kind='campaign_credit'
      AND credit_amount >= 5
      AND cosmetic_id IS NULL
      AND title_id IS NULL
      AND background_id IS NULL
    )
    OR
    (
      reward_kind='game_cosmetic'
      AND credit_amount IS NULL
      AND cosmetic_id IS NOT NULL
      AND title_id IS NULL
      AND background_id IS NULL
    )
    OR
    (
      reward_kind='commander_title'
      AND credit_amount IS NULL
      AND cosmetic_id IS NULL
      AND title_id IS NOT NULL
      AND background_id IS NULL
    )
    OR
    (
      reward_kind='profile_background'
      AND credit_amount IS NULL
      AND cosmetic_id IS NULL
      AND title_id IS NULL
      AND background_id IS NOT NULL
    )
  ),
  CHECK (btrim(id) <> ''),
  CHECK (presentation_group_key IS NULL OR btrim(presentation_group_key) <> '')
);

CREATE INDEX IF NOT EXISTS battle_pass_rewards_season_track_level_idx
  ON catalog.battle_pass_rewards(season_id,track,level,position);

CREATE TABLE IF NOT EXISTS progression.battle_pass_progress (
  season_id TEXT NOT NULL
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  xp_total BIGINT NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
  level_reached SMALLINT NOT NULL DEFAULT 1 CHECK (level_reached BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season_id,user_id)
);

CREATE INDEX IF NOT EXISTS battle_pass_progress_user_updated_idx
  ON progression.battle_pass_progress(user_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS progression.battle_pass_xp_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season_id TEXT NOT NULL
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  source_type VARCHAR(24) NOT NULL
    CHECK (source_type IN ('match','admin_adjustment')),
  source_key TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (btrim(source_key) <> ''),
  UNIQUE (season_id,user_id,source_type,source_key)
);

CREATE INDEX IF NOT EXISTS battle_pass_xp_entries_user_created_idx
  ON progression.battle_pass_xp_entries(user_id,created_at DESC,id DESC);

CREATE TABLE IF NOT EXISTS progression.battle_pass_access (
  season_id TEXT NOT NULL
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  purchase_id UUID
    REFERENCES economy.purchases(id) ON DELETE RESTRICT,
  access_source VARCHAR(24) NOT NULL
    CHECK (access_source IN ('purchase','promotion','admin')),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season_id,user_id),
  CONSTRAINT battle_pass_access_purchase_shape_check CHECK (
    (access_source='purchase' AND purchase_id IS NOT NULL)
    OR (access_source<>'purchase' AND purchase_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS battle_pass_access_purchase_uidx
  ON progression.battle_pass_access(purchase_id)
  WHERE purchase_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS progression.battle_pass_reward_claims (
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id,reward_id),
  CONSTRAINT battle_pass_reward_claims_reward_fkey
    FOREIGN KEY (reward_id,season_id)
    REFERENCES catalog.battle_pass_rewards(id,season_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS battle_pass_reward_claims_user_season_idx
  ON progression.battle_pass_reward_claims(user_id,season_id,claimed_at DESC);

ALTER TABLE game.matches
  ADD COLUMN IF NOT EXISTS battle_pass_season_id TEXT,
  ADD COLUMN IF NOT EXISTS battle_pass_xp_profile_id TEXT,
  ADD COLUMN IF NOT EXISTS battle_pass_xp_profile_snapshot JSONB;

ALTER TABLE game.matches
  DROP CONSTRAINT IF EXISTS matches_battle_pass_season_fkey;
ALTER TABLE game.matches
  ADD CONSTRAINT matches_battle_pass_season_fkey
  FOREIGN KEY (battle_pass_season_id)
  REFERENCES catalog.battle_pass_seasons(id)
  ON DELETE RESTRICT;

ALTER TABLE game.matches
  DROP CONSTRAINT IF EXISTS matches_battle_pass_xp_profile_fkey;
ALTER TABLE game.matches
  ADD CONSTRAINT matches_battle_pass_xp_profile_fkey
  FOREIGN KEY (battle_pass_xp_profile_id)
  REFERENCES catalog.battle_pass_xp_profiles(id)
  ON DELETE RESTRICT;

ALTER TABLE game.matches
  DROP CONSTRAINT IF EXISTS matches_battle_pass_snapshot_shape_check;
ALTER TABLE game.matches
  ADD CONSTRAINT matches_battle_pass_snapshot_shape_check CHECK (
    (
      battle_pass_season_id IS NULL
      AND battle_pass_xp_profile_id IS NULL
      AND battle_pass_xp_profile_snapshot IS NULL
    )
    OR
    (
      battle_pass_season_id IS NOT NULL
      AND battle_pass_xp_profile_id IS NOT NULL
      AND battle_pass_xp_profile_snapshot IS NOT NULL
      AND jsonb_typeof(battle_pass_xp_profile_snapshot)='object'
    )
  );

CREATE OR REPLACE FUNCTION game.reject_match_battle_pass_snapshot_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  RAISE EXCEPTION 'match battle-pass snapshot fields are immutable after match creation';
END
$body$;

DROP TRIGGER IF EXISTS matches_battle_pass_snapshot_immutable
  ON game.matches;
CREATE TRIGGER matches_battle_pass_snapshot_immutable
BEFORE UPDATE OF battle_pass_season_id,battle_pass_xp_profile_id,battle_pass_xp_profile_snapshot
ON game.matches
FOR EACH ROW EXECUTE FUNCTION game.reject_match_battle_pass_snapshot_mutation();

ALTER TABLE game.match_participants
  ADD COLUMN IF NOT EXISTS left_at_snapshot TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  level_count INTEGER;
  free_credit BIGINT;
  premium_credit BIGINT;
  free_level_100_titles INTEGER;
  premium_level_100_titles INTEGER;
  level_100_credit_count INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::int
    INTO level_count
    FROM catalog.battle_pass_levels
   WHERE season_id=NEW.id;

  IF level_count <> 100 THEN
    RAISE EXCEPTION 'active battle pass requires exactly 100 levels';
  END IF;

  SELECT
    COALESCE(SUM(credit_amount) FILTER (
      WHERE track='free' AND reward_kind='campaign_credit'
    ),0),
    COALESCE(SUM(credit_amount) FILTER (
      WHERE track='premium' AND reward_kind='campaign_credit'
    ),0),
    COUNT(*) FILTER (
      WHERE level=100 AND track='free' AND reward_kind='commander_title'
    ),
    COUNT(*) FILTER (
      WHERE level=100 AND track='premium' AND reward_kind='commander_title'
    ),
    COUNT(*) FILTER (
      WHERE level=100 AND reward_kind='campaign_credit'
    )
  INTO
    free_credit,
    premium_credit,
    free_level_100_titles,
    premium_level_100_titles,
    level_100_credit_count
  FROM catalog.battle_pass_rewards
  WHERE season_id=NEW.id;

  IF free_credit <> 1000 THEN
    RAISE EXCEPTION 'active battle pass free track must grant exactly 1000 campaign credits';
  END IF;
  IF premium_credit <> 2500 THEN
    RAISE EXCEPTION 'active battle pass premium track must grant exactly 2500 campaign credits';
  END IF;
  IF free_level_100_titles <> 1 OR premium_level_100_titles <> 1 THEN
    RAISE EXCEPTION 'active battle pass requires one free and one premium title at level 100';
  END IF;
  IF level_100_credit_count <> 0 THEN
    RAISE EXCEPTION 'battle pass level 100 cannot grant campaign credits';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_seasons_activation_guard
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_seasons_activation_guard
BEFORE INSERT OR UPDATE OF status
ON catalog.battle_pass_seasons
FOR EACH ROW EXECUTE FUNCTION catalog.validate_battle_pass_activation();

COMMENT ON TABLE catalog.battle_pass_seasons IS
  'Versioned seasonal Battle Pass catalog. V1 seasons contain exactly 100 levels.';
COMMENT ON TABLE catalog.battle_pass_levels IS
  'Per-season cumulative XP thresholds. The active season is validated before activation.';
COMMENT ON TABLE catalog.battle_pass_rewards IS
  'Free/premium reward definitions. Reward ownership is granted only through progression claims.';
COMMENT ON TABLE progression.battle_pass_xp_entries IS
  'Append-only, idempotent XP grant ledger. Match grants are unique per user and match.';
COMMENT ON TABLE progression.battle_pass_progress IS
  'Materialized seasonal XP/level read model derived from XP grants.';
COMMENT ON TABLE progression.battle_pass_access IS
  'Per-season Elite access. Purchase access is tied to an Economy V2 purchase receipt.';
COMMENT ON TABLE progression.battle_pass_reward_claims IS
  'Durable proof that one Battle Pass reward was delivered to one user.';
COMMENT ON COLUMN game.matches.battle_pass_xp_profile_snapshot IS
  'Immutable XP-policy snapshot selected when the match starts. NULL means no active season.';

-- Down Migration
-- Progression/claim history is durable user-facing state. Prefer forward migrations.
