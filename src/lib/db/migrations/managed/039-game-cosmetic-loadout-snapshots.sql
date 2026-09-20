-- Freeze player cosmetic presentation at match start.
-- Runtime game reads must not depend on mutable profile/catalog state.

-- Up Migration

CREATE UNIQUE INDEX IF NOT EXISTS catalog_cosmetics_default_slot_uidx
  ON catalog.cosmetics (slot)
  WHERE is_default = TRUE;

DO $$
DECLARE
  default_count INTEGER;
BEGIN
  SELECT COUNT(*)::int
    INTO default_count
    FROM catalog.cosmetics
   WHERE is_default = TRUE;

  IF default_count <> 4 THEN
    RAISE EXCEPTION
      'Expected exactly four default cosmetics before creating game snapshots, found %',
      default_count;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS game.player_cosmetic_loadouts (
  player_id BIGINT NOT NULL
    REFERENCES game.players(id) ON DELETE CASCADE,
  slot VARCHAR(32) NOT NULL,
  cosmetic_id TEXT NOT NULL,
  asset_ref TEXT,
  effect_key TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, slot),
  CONSTRAINT player_cosmetic_loadouts_slot_check
    CHECK (slot IN ('dice_attack', 'dice_defense', 'dice_neutral', 'territory_effect')),
  CONSTRAINT player_cosmetic_loadouts_catalog_fkey
    FOREIGN KEY (cosmetic_id, slot)
    REFERENCES catalog.cosmetics(id, slot)
    ON DELETE RESTRICT,
  CHECK (asset_ref IS NULL OR btrim(asset_ref) <> ''),
  CHECK (effect_key IS NULL OR btrim(effect_key) <> '')
);

CREATE INDEX IF NOT EXISTS player_cosmetic_loadouts_cosmetic_idx
  ON game.player_cosmetic_loadouts (cosmetic_id, player_id);

-- Backfill already-existing seats so an in-flight/legacy room remains readable
-- immediately after deploying this migration. Human seats prefer their current
-- equipped loadout; bots and incomplete legacy identities fall back to defaults.
WITH defaults AS (
  SELECT id, slot, asset_ref, effect_key
    FROM catalog.cosmetics
   WHERE is_default = TRUE
),
resolved AS (
  SELECT player.id AS player_id,
         defaults.slot,
         COALESCE(equipped.id, defaults.id) AS cosmetic_id,
         CASE
           WHEN equipped.id IS NOT NULL THEN equipped.asset_ref
           ELSE defaults.asset_ref
         END AS asset_ref,
         CASE
           WHEN equipped.id IS NOT NULL THEN equipped.effect_key
           ELSE defaults.effect_key
         END AS effect_key
    FROM game.players player
    CROSS JOIN defaults
    LEFT JOIN profile.cosmetic_loadout loadout
      ON loadout.user_id = player.user_id
     AND loadout.slot = defaults.slot
    LEFT JOIN catalog.cosmetics equipped
      ON equipped.id = loadout.cosmetic_id
     AND equipped.slot = loadout.slot
)
INSERT INTO game.player_cosmetic_loadouts(
  player_id, slot, cosmetic_id, asset_ref, effect_key, captured_at
)
SELECT player_id, slot, cosmetic_id, asset_ref, effect_key, NOW()
  FROM resolved
ON CONFLICT (player_id, slot) DO NOTHING;

COMMENT ON TABLE game.player_cosmetic_loadouts IS
  'Immutable-within-match cosmetic snapshot copied from profile at startGame; runtime rendering reads only game.*.';
COMMENT ON COLUMN game.player_cosmetic_loadouts.asset_ref IS
  'Frozen render asset reference for this match; catalog edits do not affect a running match.';
COMMENT ON COLUMN game.player_cosmetic_loadouts.effect_key IS
  'Frozen semantic territory/dice effect key for this match.';
