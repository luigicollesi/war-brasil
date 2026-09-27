-- Passe de Campanha V1: accumulated in-match XP model.
-- Extends the existing end-of-match XP model with server-authoritative action
-- accumulation and idempotent settlement while preserving old match snapshots.
--
-- Up Migration

ALTER TABLE catalog.battle_pass_xp_profiles
  ADD COLUMN IF NOT EXISTS action_model_version SMALLINT NOT NULL DEFAULT 2
    CHECK (action_model_version >= 1),
  ADD COLUMN IF NOT EXISTS troop_placed_xp INTEGER NOT NULL DEFAULT 1
    CHECK (troop_placed_xp >= 0),
  ADD COLUMN IF NOT EXISTS troop_placed_cap_xp INTEGER NOT NULL DEFAULT 60
    CHECK (troop_placed_cap_xp >= 0),
  ADD COLUMN IF NOT EXISTS card_trade_xp INTEGER NOT NULL DEFAULT 20
    CHECK (card_trade_xp >= 0),
  ADD COLUMN IF NOT EXISTS card_trade_cap_xp INTEGER NOT NULL DEFAULT 80
    CHECK (card_trade_cap_xp >= 0),
  ADD COLUMN IF NOT EXISTS troop_lost_dice_xp INTEGER NOT NULL DEFAULT 1
    CHECK (troop_lost_dice_xp >= 0),
  ADD COLUMN IF NOT EXISTS troop_lost_dice_cap_xp INTEGER NOT NULL DEFAULT 50
    CHECK (troop_lost_dice_cap_xp >= 0),
  ADD COLUMN IF NOT EXISTS enemy_troop_defeated_xp INTEGER NOT NULL DEFAULT 2
    CHECK (enemy_troop_defeated_xp >= 0),
  ADD COLUMN IF NOT EXISTS enemy_troop_defeated_cap_xp INTEGER NOT NULL DEFAULT 100
    CHECK (enemy_troop_defeated_cap_xp >= 0),
  ADD COLUMN IF NOT EXISTS territory_first_conquest_xp INTEGER NOT NULL DEFAULT 25
    CHECK (territory_first_conquest_xp >= 0),
  ADD COLUMN IF NOT EXISTS territory_second_conquest_xp INTEGER NOT NULL DEFAULT 10
    CHECK (territory_second_conquest_xp >= 0);

CREATE TABLE IF NOT EXISTS progression.battle_pass_match_progress (
  match_id BIGINT NOT NULL
    REFERENCES game.matches(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  player_id_snapshot BIGINT NOT NULL,
  multiplier_bps INTEGER NOT NULL DEFAULT 10000
    CHECK (multiplier_bps BETWEEN 0 AND 10000),
  raw_action_xp BIGINT NOT NULL DEFAULT 0 CHECK (raw_action_xp >= 0),
  scaled_action_xp BIGINT NOT NULL DEFAULT 0 CHECK (scaled_action_xp >= 0),
  troops_placed INTEGER NOT NULL DEFAULT 0 CHECK (troops_placed >= 0),
  card_sets_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (card_sets_redeemed >= 0),
  troops_lost_dice INTEGER NOT NULL DEFAULT 0 CHECK (troops_lost_dice >= 0),
  enemy_troops_defeated_dice INTEGER NOT NULL DEFAULT 0
    CHECK (enemy_troops_defeated_dice >= 0),
  settled_at TIMESTAMPTZ,
  settled_reason VARCHAR(24)
    CHECK (settled_reason IS NULL OR settled_reason IN ('match_completed','player_left')),
  settled_xp BIGINT CHECK (settled_xp IS NULL OR settled_xp >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id,user_id),
  UNIQUE (match_id,player_id_snapshot),
  CHECK (scaled_action_xp <= raw_action_xp),
  CHECK (
    (settled_at IS NULL AND settled_reason IS NULL AND settled_xp IS NULL)
    OR
    (settled_at IS NOT NULL AND settled_reason IS NOT NULL AND settled_xp IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS battle_pass_match_progress_user_idx
  ON progression.battle_pass_match_progress(user_id,match_id DESC);

CREATE TABLE IF NOT EXISTS progression.battle_pass_match_xp_actions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id BIGINT NOT NULL
    REFERENCES game.matches(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  action_kind VARCHAR(32) NOT NULL
    CHECK (action_kind IN (
      'troops_placed',
      'card_trade',
      'combat',
      'territory_conquest'
    )),
  units INTEGER NOT NULL DEFAULT 1 CHECK (units >= 0),
  raw_xp BIGINT NOT NULL CHECK (raw_xp >= 0),
  awarded_xp BIGINT NOT NULL CHECK (awarded_xp >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (btrim(source_key) <> ''),
  UNIQUE (match_id,user_id,source_key)
);

CREATE INDEX IF NOT EXISTS battle_pass_match_xp_actions_user_idx
  ON progression.battle_pass_match_xp_actions(user_id,match_id,created_at,id);

CREATE TABLE IF NOT EXISTS progression.battle_pass_match_territory_conquests (
  match_id BIGINT NOT NULL
    REFERENCES game.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  territory_id SMALLINT NOT NULL CHECK (territory_id BETWEEN 1 AND 42),
  conquest_count INTEGER NOT NULL DEFAULT 0 CHECK (conquest_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id,user_id,territory_id)
);

COMMENT ON TABLE progression.battle_pass_match_progress IS
  'Per-match Battle Pass XP accumulator. Seasonal progress changes only when this row is settled.';
COMMENT ON TABLE progression.battle_pass_match_xp_actions IS
  'Idempotent audit ledger of authoritative gameplay actions that contribute pending Battle Pass XP.';
COMMENT ON TABLE progression.battle_pass_match_territory_conquests IS
  'Per-user conquest counters used for first/second conquest diminishing returns within one match.';
COMMENT ON COLUMN catalog.battle_pass_xp_profiles.action_model_version IS
  'Version 2 enables accumulated in-match XP. Old snapshots without this field remain legacy end-of-match XP.';

-- Down Migration
-- Match XP history and settlements are durable progression state; use a forward migration.
