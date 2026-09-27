-- Passe de Campanha V1: Economy V2 entitlement support for Elite access.
-- No concrete season/product/offer is seeded here; catalog content is activated
-- only after the first season rewards, XP curve and assets are defined.
--
-- Up Migration

ALTER TABLE catalog.product_entitlements
  ADD COLUMN IF NOT EXISTS battle_pass_season_id TEXT;

ALTER TABLE catalog.product_entitlements
  DROP CONSTRAINT IF EXISTS product_entitlements_entitlement_kind_check,
  DROP CONSTRAINT IF EXISTS product_entitlements_kind_check,
  DROP CONSTRAINT IF EXISTS product_entitlements_shape_check,
  DROP CONSTRAINT IF EXISTS product_entitlements_battle_pass_season_fkey;

ALTER TABLE catalog.product_entitlements
  ADD CONSTRAINT product_entitlements_kind_check
    CHECK (entitlement_kind IN (
      'game_cosmetic',
      'commander_title',
      'profile_background',
      'battle_pass_access'
    )),
  ADD CONSTRAINT product_entitlements_battle_pass_season_fkey
    FOREIGN KEY (battle_pass_season_id)
    REFERENCES catalog.battle_pass_seasons(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT product_entitlements_shape_check CHECK (
    (entitlement_kind='game_cosmetic'
      AND cosmetic_id IS NOT NULL AND title_id IS NULL
      AND background_id IS NULL AND battle_pass_season_id IS NULL)
    OR
    (entitlement_kind='commander_title'
      AND cosmetic_id IS NULL AND title_id IS NOT NULL
      AND background_id IS NULL AND battle_pass_season_id IS NULL)
    OR
    (entitlement_kind='profile_background'
      AND cosmetic_id IS NULL AND title_id IS NULL
      AND background_id IS NOT NULL AND battle_pass_season_id IS NULL)
    OR
    (entitlement_kind='battle_pass_access'
      AND cosmetic_id IS NULL AND title_id IS NULL
      AND background_id IS NULL AND battle_pass_season_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS product_entitlements_battle_pass_uidx
  ON catalog.product_entitlements(product_id,battle_pass_season_id)
  WHERE battle_pass_season_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalog.battle_pass_pricing (
  season_id TEXT PRIMARY KEY
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  fixed_price BIGINT NOT NULL CHECK (fixed_price = 3000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog.battle_pass_stats (
  season_id TEXT PRIMARY KEY
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  acquisition_count BIGINT NOT NULL DEFAULT 0 CHECK (acquisition_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO catalog.battle_pass_stats(season_id,acquisition_count)
SELECT season.id,COUNT(access.user_id)::bigint
  FROM catalog.battle_pass_seasons season
  LEFT JOIN progression.battle_pass_access access
    ON access.season_id=season.id
 GROUP BY season.id
ON CONFLICT (season_id) DO NOTHING;

CREATE OR REPLACE FUNCTION catalog.ensure_battle_pass_stats_row()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  INSERT INTO catalog.battle_pass_stats(season_id,acquisition_count)
  VALUES(NEW.id,0)
  ON CONFLICT (season_id) DO NOTHING;
  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_stats_after_insert
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_stats_after_insert
AFTER INSERT ON catalog.battle_pass_seasons
FOR EACH ROW EXECUTE FUNCTION catalog.ensure_battle_pass_stats_row();

ALTER TABLE economy.purchase_entitlements
  ADD COLUMN IF NOT EXISTS battle_pass_season_id TEXT;

ALTER TABLE economy.purchase_entitlements
  DROP CONSTRAINT IF EXISTS purchase_entitlements_entitlement_kind_check,
  DROP CONSTRAINT IF EXISTS purchase_entitlements_kind_check,
  DROP CONSTRAINT IF EXISTS purchase_entitlements_shape_check,
  DROP CONSTRAINT IF EXISTS purchase_entitlements_battle_pass_season_fkey;

ALTER TABLE economy.purchase_entitlements
  ADD CONSTRAINT purchase_entitlements_kind_check
    CHECK (entitlement_kind IN (
      'game_cosmetic',
      'commander_title',
      'profile_background',
      'battle_pass_access'
    )),
  ADD CONSTRAINT purchase_entitlements_battle_pass_season_fkey
    FOREIGN KEY (battle_pass_season_id)
    REFERENCES catalog.battle_pass_seasons(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT purchase_entitlements_shape_check CHECK (
    (entitlement_kind='game_cosmetic'
      AND cosmetic_id IS NOT NULL AND title_id IS NULL
      AND background_id IS NULL AND battle_pass_season_id IS NULL)
    OR
    (entitlement_kind='commander_title'
      AND cosmetic_id IS NULL AND title_id IS NOT NULL
      AND background_id IS NULL AND battle_pass_season_id IS NULL)
    OR
    (entitlement_kind='profile_background'
      AND cosmetic_id IS NULL AND title_id IS NULL
      AND background_id IS NOT NULL AND battle_pass_season_id IS NULL)
    OR
    (entitlement_kind='battle_pass_access'
      AND cosmetic_id IS NULL AND title_id IS NULL
      AND background_id IS NULL AND battle_pass_season_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS purchase_entitlements_battle_pass_idx
  ON economy.purchase_entitlements(battle_pass_season_id,purchase_id)
  WHERE battle_pass_season_id IS NOT NULL;

COMMENT ON TABLE catalog.battle_pass_pricing IS
  'Fixed V1 Elite price. Every purchasable Battle Pass season costs exactly 3000 campaign credits.';
COMMENT ON TABLE catalog.battle_pass_stats IS
  'Global acquisition counter for Battle Pass Elite access through Economy V2.';
COMMENT ON COLUMN catalog.product_entitlements.battle_pass_season_id IS
  'Season granted when entitlement_kind=battle_pass_access.';
COMMENT ON COLUMN economy.purchase_entitlements.battle_pass_season_id IS
  'Immutable purchased Battle Pass season snapshot.';

-- Down Migration
-- Purchase/access history is durable; prefer forward migrations.
