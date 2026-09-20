-- Economy entitlement foundation.
-- Products may grant gameplay cosmetics, commander titles or profile backgrounds
-- without forcing social/profile items into inventory.cosmetics.
--
-- Up Migration

CREATE TABLE IF NOT EXISTS catalog.product_entitlements (
  product_id TEXT NOT NULL
    REFERENCES catalog.products(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position >= 0),
  entitlement_kind VARCHAR(32) NOT NULL
    CHECK (entitlement_kind IN ('game_cosmetic','commander_title','profile_background')),
  cosmetic_id TEXT REFERENCES catalog.cosmetics(id) ON DELETE RESTRICT,
  title_id TEXT REFERENCES catalog.commander_titles(id) ON DELETE RESTRICT,
  background_id TEXT REFERENCES catalog.profile_backgrounds(id) ON DELETE RESTRICT,
  PRIMARY KEY (product_id, position),
  CONSTRAINT product_entitlements_shape_check CHECK (
    (entitlement_kind='game_cosmetic'
      AND cosmetic_id IS NOT NULL AND title_id IS NULL AND background_id IS NULL)
    OR
    (entitlement_kind='commander_title'
      AND cosmetic_id IS NULL AND title_id IS NOT NULL AND background_id IS NULL)
    OR
    (entitlement_kind='profile_background'
      AND cosmetic_id IS NULL AND title_id IS NULL AND background_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS product_entitlements_cosmetic_uidx
  ON catalog.product_entitlements(product_id,cosmetic_id)
  WHERE cosmetic_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_entitlements_title_uidx
  ON catalog.product_entitlements(product_id,title_id)
  WHERE title_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_entitlements_background_uidx
  ON catalog.product_entitlements(product_id,background_id)
  WHERE background_id IS NOT NULL;

INSERT INTO catalog.product_entitlements(
  product_id,position,entitlement_kind,cosmetic_id
)
SELECT product_id,position,'game_cosmetic',cosmetic_id
  FROM catalog.product_items
ON CONFLICT (product_id,position) DO NOTHING;

CREATE TABLE IF NOT EXISTS catalog.commander_title_pricing (
  title_id TEXT PRIMARY KEY
    REFERENCES catalog.commander_titles(id) ON DELETE CASCADE,
  fixed_price BIGINT NOT NULL CHECK (fixed_price > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog.profile_background_pricing (
  background_id TEXT PRIMARY KEY
    REFERENCES catalog.profile_backgrounds(id) ON DELETE CASCADE,
  fixed_price BIGINT NOT NULL CHECK (fixed_price > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog.commander_title_stats (
  title_id TEXT PRIMARY KEY
    REFERENCES catalog.commander_titles(id) ON DELETE CASCADE,
  acquisition_count BIGINT NOT NULL DEFAULT 0 CHECK (acquisition_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog.profile_background_stats (
  background_id TEXT PRIMARY KEY
    REFERENCES catalog.profile_backgrounds(id) ON DELETE CASCADE,
  acquisition_count BIGINT NOT NULL DEFAULT 0 CHECK (acquisition_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO catalog.commander_title_stats(title_id,acquisition_count)
SELECT title.id,COUNT(owned.user_id)::bigint
  FROM catalog.commander_titles title
  LEFT JOIN profile.commander_titles owned ON owned.title_id=title.id
 GROUP BY title.id
ON CONFLICT (title_id) DO NOTHING;

INSERT INTO catalog.profile_background_stats(background_id,acquisition_count)
SELECT background.id,COUNT(owned.user_id)::bigint
  FROM catalog.profile_backgrounds background
  LEFT JOIN profile.commander_backgrounds owned
    ON owned.background_id=background.id
 GROUP BY background.id
ON CONFLICT (background_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS economy.purchase_entitlements (
  purchase_id UUID NOT NULL
    REFERENCES economy.purchases(id) ON DELETE RESTRICT,
  position SMALLINT NOT NULL CHECK (position >= 0),
  entitlement_kind VARCHAR(32) NOT NULL
    CHECK (entitlement_kind IN ('game_cosmetic','commander_title','profile_background')),
  cosmetic_id TEXT REFERENCES catalog.cosmetics(id) ON DELETE RESTRICT,
  title_id TEXT REFERENCES catalog.commander_titles(id) ON DELETE RESTRICT,
  background_id TEXT REFERENCES catalog.profile_backgrounds(id) ON DELETE RESTRICT,
  unit_price BIGINT CHECK (unit_price IS NULL OR unit_price >= 0),
  PRIMARY KEY (purchase_id,position),
  CONSTRAINT purchase_entitlements_shape_check CHECK (
    (entitlement_kind='game_cosmetic'
      AND cosmetic_id IS NOT NULL AND title_id IS NULL AND background_id IS NULL)
    OR
    (entitlement_kind='commander_title'
      AND cosmetic_id IS NULL AND title_id IS NOT NULL AND background_id IS NULL)
    OR
    (entitlement_kind='profile_background'
      AND cosmetic_id IS NULL AND title_id IS NULL AND background_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS purchase_entitlements_purchase_kind_idx
  ON economy.purchase_entitlements(purchase_id,entitlement_kind,position);

-- Preserve historical gameplay purchases in the generic receipt table.
INSERT INTO economy.purchase_entitlements(
  purchase_id,position,entitlement_kind,cosmetic_id,unit_price
)
SELECT purchased.purchase_id,
       (ROW_NUMBER() OVER (
         PARTITION BY purchased.purchase_id
         ORDER BY purchased.cosmetic_id
       ) - 1)::smallint,
       'game_cosmetic',
       purchased.cosmetic_id,
       purchased.unit_price
  FROM economy.purchase_items purchased
ON CONFLICT (purchase_id,position) DO NOTHING;

COMMENT ON TABLE catalog.product_entitlements IS
  'Canonical product grants across gameplay cosmetics and profile appearance entitlements.';
COMMENT ON TABLE catalog.commander_title_pricing IS
  'Fixed campaign-credit prices for purchasable commander-title entitlements.';
COMMENT ON TABLE catalog.profile_background_pricing IS
  'Fixed campaign-credit prices for purchasable profile-background entitlements.';
COMMENT ON TABLE economy.purchase_entitlements IS
  'Immutable purchase grant snapshot across all entitlement kinds.';

-- Down Migration
-- Forward fixes are preferred after rollout because purchase/ownership history is durable.
