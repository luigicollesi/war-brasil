-- Storefront V2: products, collections, itemized pricing, campaigns and timed offers.
-- This migration is intentionally additive: legacy cosmetic_sets, offer_items and
-- offers.price remain available while application reads/writes migrate to the new model.

-- Up Migration

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Canonical slot terminology: territory_effect -> territory_skin.
-- Drop composite FKs first, update every persisted copy, then restore constraints.
-- ---------------------------------------------------------------------------

ALTER TABLE profile.cosmetic_loadout
  DROP CONSTRAINT IF EXISTS cosmetic_loadout_owned_item_fkey,
  DROP CONSTRAINT IF EXISTS cosmetic_loadout_slot_check;

ALTER TABLE inventory.cosmetics
  DROP CONSTRAINT IF EXISTS inventory_cosmetic_slot_fkey;

ALTER TABLE game.player_cosmetic_loadouts
  DROP CONSTRAINT IF EXISTS player_cosmetic_loadouts_catalog_fkey,
  DROP CONSTRAINT IF EXISTS player_cosmetic_loadouts_slot_check,
  DROP CONSTRAINT IF EXISTS player_cosmetic_loadouts_territory_effect_mode_check,
  DROP CONSTRAINT IF EXISTS player_cosmetic_loadouts_territory_skin_mode_check;

ALTER TABLE catalog.cosmetics
  DROP CONSTRAINT IF EXISTS cosmetics_slot_check,
  DROP CONSTRAINT IF EXISTS cosmetics_territory_effect_mode_check,
  DROP CONSTRAINT IF EXISTS cosmetics_territory_skin_mode_check;

UPDATE catalog.cosmetics
   SET slot='territory_skin',
       updated_at=NOW()
 WHERE slot='territory_effect';

UPDATE inventory.cosmetics
   SET slot='territory_skin'
 WHERE slot='territory_effect';

UPDATE profile.cosmetic_loadout
   SET slot='territory_skin',
       updated_at=NOW()
 WHERE slot='territory_effect';

UPDATE game.player_cosmetic_loadouts
   SET slot='territory_skin'
 WHERE slot='territory_effect';

ALTER TABLE catalog.cosmetics
  ADD CONSTRAINT cosmetics_slot_check
  CHECK (slot IN ('dice_attack', 'dice_defense', 'dice_neutral', 'territory_skin'));

ALTER TABLE catalog.cosmetics
  ADD CONSTRAINT cosmetics_territory_skin_mode_check
  CHECK (
    slot <> 'territory_skin'
    OR (
      (effect_key IS NOT NULL AND asset_ref IS NULL)
      OR (
        effect_key IS NULL
        AND asset_ref IS NOT NULL
        AND asset_ref ~ '^cosmetics/territory-skins/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$'
      )
    )
  );

ALTER TABLE inventory.cosmetics
  ADD CONSTRAINT inventory_cosmetic_slot_fkey
  FOREIGN KEY (cosmetic_id, slot)
  REFERENCES catalog.cosmetics(id, slot)
  ON DELETE RESTRICT;

ALTER TABLE profile.cosmetic_loadout
  ADD CONSTRAINT cosmetic_loadout_slot_check
  CHECK (slot IN ('dice_attack', 'dice_defense', 'dice_neutral', 'territory_skin')),
  ADD CONSTRAINT cosmetic_loadout_owned_item_fkey
  FOREIGN KEY (user_id, slot, cosmetic_id)
  REFERENCES inventory.cosmetics(user_id, slot, cosmetic_id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE game.player_cosmetic_loadouts
  ADD CONSTRAINT player_cosmetic_loadouts_slot_check
  CHECK (slot IN ('dice_attack', 'dice_defense', 'dice_neutral', 'territory_skin')),
  ADD CONSTRAINT player_cosmetic_loadouts_catalog_fkey
  FOREIGN KEY (cosmetic_id, slot)
  REFERENCES catalog.cosmetics(id, slot)
  ON DELETE RESTRICT,
  ADD CONSTRAINT player_cosmetic_loadouts_territory_skin_mode_check
  CHECK (
    slot <> 'territory_skin'
    OR (
      (effect_key IS NOT NULL AND asset_ref IS NULL)
      OR (
        effect_key IS NULL
        AND asset_ref IS NOT NULL
        AND asset_ref ~ '^cosmetics/territory-skins/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Collections and semantic asset mappings.
-- V1 collection merchandising intentionally has only banner/background/logo.
-- Historical mappings may remain, but at most one active mapping exists per role.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS catalog.collections (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name VARCHAR(96) NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (btrim(id) <> ''),
  CHECK (btrim(slug) <> ''),
  CHECK (btrim(name) <> ''),
  CHECK (description IS NULL OR btrim(description) <> '')
);

CREATE TABLE IF NOT EXISTS catalog.collection_assets (
  id BIGSERIAL PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES catalog.collections(id) ON DELETE CASCADE,
  role VARCHAR(24) NOT NULL,
  object_key TEXT NOT NULL,
  mime_type VARCHAR(96) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT collection_assets_identity_uq UNIQUE (collection_id, role, object_key),
  CONSTRAINT collection_assets_role_check
    CHECK (role IN ('banner', 'background', 'logo')),
  CHECK (btrim(object_key) <> ''),
  CHECK (object_key !~ '^[a-z]+://'),
  CHECK (btrim(mime_type) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_collection_assets_one_active_role_uq
  ON catalog.collection_assets(collection_id, role)
  WHERE active;

CREATE INDEX IF NOT EXISTS catalog_collection_assets_active_idx
  ON catalog.collection_assets(collection_id, active, role, id);

ALTER TABLE catalog.cosmetics
  ADD COLUMN IF NOT EXISTS collection_id TEXT;

ALTER TABLE catalog.cosmetics
  DROP CONSTRAINT IF EXISTS cosmetics_collection_fkey;
ALTER TABLE catalog.cosmetics
  ADD CONSTRAINT cosmetics_collection_fkey
  FOREIGN KEY (collection_id)
  REFERENCES catalog.collections(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS catalog_cosmetics_collection_idx
  ON catalog.cosmetics(collection_id, slot, id);

CREATE TABLE IF NOT EXISTS catalog.cosmetic_assets (
  cosmetic_id TEXT NOT NULL REFERENCES catalog.cosmetics(id) ON DELETE CASCADE,
  role VARCHAR(24) NOT NULL,
  object_key TEXT NOT NULL,
  mime_type VARCHAR(96) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cosmetic_id, role),
  CONSTRAINT cosmetic_assets_role_check
    CHECK (role IN ('primary', 'preview', 'surface', 'pattern', 'overlay')),
  CHECK (btrim(object_key) <> ''),
  CHECK (object_key !~ '^[a-z]+://'),
  CHECK (btrim(mime_type) <> ''),
  CHECK (version > 0)
);

-- Existing cosmetic sets become permanent collection identities. Prefer the stable
-- storage slug so the public catalogue can use language-independent identifiers
-- such as `football` while the legacy set IDs remain untouched during rollout.
INSERT INTO catalog.collections(id, slug, name, description, active, sort_order)
SELECT 'collection.' || COALESCE(cosmetic_set.storage_slug, substr(cosmetic_set.id, 5)),
       COALESCE(cosmetic_set.storage_slug, cosmetic_set.slug),
       cosmetic_set.name,
       cosmetic_set.description,
       cosmetic_set.status <> 'retired',
       cosmetic_set.sort_order
  FROM catalog.cosmetic_sets cosmetic_set
ON CONFLICT (id) DO NOTHING;

UPDATE catalog.cosmetics item
   SET collection_id = membership.collection_id,
       updated_at = NOW()
  FROM (
    SELECT set_item.cosmetic_id,
           MIN(
             'collection.' || COALESCE(cosmetic_set.storage_slug, substr(set_item.set_id, 5))
           ) AS collection_id
      FROM catalog.cosmetic_set_items set_item
      JOIN catalog.cosmetic_sets cosmetic_set ON cosmetic_set.id=set_item.set_id
     GROUP BY set_item.cosmetic_id
  ) membership
 WHERE membership.cosmetic_id=item.id
   AND item.collection_id IS NULL;

-- Football is the V1 reference dice-only collection. These rows are merchandising
-- metadata, not inventory and not canonical cosmetic previews.
INSERT INTO catalog.collection_assets(
  collection_id,
  role,
  object_key,
  mime_type,
  active
)
VALUES
  ('collection.football', 'banner', 'store/collections/football/banner.webp', 'image/webp', TRUE),
  ('collection.football', 'background', 'store/collections/football/background.webp', 'image/webp', TRUE),
  ('collection.football', 'logo', 'store/collections/football/logo.webp', 'image/webp', TRUE)
ON CONFLICT (collection_id, role, object_key) DO UPDATE
SET mime_type=EXCLUDED.mime_type,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.cosmetic_assets(cosmetic_id, role, object_key, mime_type, version)
SELECT item.id,
       'primary',
       item.asset_ref,
       CASE
         WHEN item.asset_ref LIKE '%.webp' THEN 'image/webp'
         WHEN item.asset_ref LIKE '%.svg' THEN 'image/svg+xml'
         ELSE 'application/octet-stream'
       END,
       1
  FROM catalog.cosmetics item
 WHERE item.asset_ref IS NOT NULL
   AND item.asset_ref !~ '^[a-z]+://'
ON CONFLICT (cosmetic_id, role) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Stable products are distinct from owned cosmetics and rotating offers.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS catalog.products (
  id TEXT PRIMARY KEY,
  collection_id TEXT REFERENCES catalog.collections(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name VARCHAR(96) NOT NULL,
  description TEXT,
  product_type VARCHAR(16) NOT NULL,
  bundle_discount_bps INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT products_type_check CHECK (product_type IN ('single', 'bundle')),
  CONSTRAINT products_discount_check CHECK (bundle_discount_bps BETWEEN 0 AND 10000),
  CONSTRAINT products_single_discount_check
    CHECK (product_type <> 'single' OR bundle_discount_bps = 0),
  CHECK (btrim(id) <> ''),
  CHECK (btrim(slug) <> ''),
  CHECK (btrim(name) <> '')
);

CREATE INDEX IF NOT EXISTS catalog_products_collection_idx
  ON catalog.products(collection_id, active, product_type, id);

CREATE TABLE IF NOT EXISTS catalog.product_items (
  product_id TEXT NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
  cosmetic_id TEXT NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, cosmetic_id),
  UNIQUE (product_id, position),
  CONSTRAINT product_items_cosmetic_fkey
    FOREIGN KEY (cosmetic_id)
    REFERENCES catalog.cosmetics(id)
    ON DELETE RESTRICT,
  CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS catalog_product_items_cosmetic_idx
  ON catalog.product_items(cosmetic_id, product_id);

-- ---------------------------------------------------------------------------
-- Item pricing. Fixed cosmetics have one authoritative fixed_price; progressive
-- cosmetics use explicit non-overlapping tiers and one global acquisition count.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS catalog.cosmetic_pricing (
  cosmetic_id TEXT PRIMARY KEY REFERENCES catalog.cosmetics(id) ON DELETE CASCADE,
  pricing_model VARCHAR(16) NOT NULL DEFAULT 'fixed',
  fixed_price BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cosmetic_pricing_model_check
    CHECK (pricing_model IN ('fixed', 'progressive')),
  CONSTRAINT cosmetic_pricing_shape_check
    CHECK (
      (pricing_model='fixed' AND fixed_price IS NOT NULL AND fixed_price > 0)
      OR (pricing_model='progressive' AND fixed_price IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS catalog.cosmetic_stats (
  cosmetic_id TEXT PRIMARY KEY REFERENCES catalog.cosmetics(id) ON DELETE CASCADE,
  acquisition_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cosmetic_stats_count_check CHECK (acquisition_count >= 0)
);

CREATE TABLE IF NOT EXISTS catalog.price_tiers (
  cosmetic_id TEXT NOT NULL REFERENCES catalog.cosmetics(id) ON DELETE CASCADE,
  acquisitions_from BIGINT NOT NULL,
  acquisitions_until BIGINT,
  price BIGINT NOT NULL,
  PRIMARY KEY (cosmetic_id, acquisitions_from),
  CONSTRAINT price_tiers_from_check CHECK (acquisitions_from >= 0),
  CONSTRAINT price_tiers_until_check
    CHECK (acquisitions_until IS NULL OR acquisitions_until >= acquisitions_from),
  CONSTRAINT price_tiers_price_check CHECK (price > 0),
  CONSTRAINT price_tiers_no_overlap
    EXCLUDE USING gist (
      cosmetic_id WITH =,
      (int8range(acquisitions_from, acquisitions_until, '[]')) WITH &&
    )
);

CREATE INDEX IF NOT EXISTS catalog_price_tiers_lookup_idx
  ON catalog.price_tiers(cosmetic_id, acquisitions_from DESC);

INSERT INTO catalog.cosmetic_stats(cosmetic_id, acquisition_count)
SELECT item.id, COUNT(owned.user_id)::bigint
  FROM catalog.cosmetics item
  LEFT JOIN inventory.cosmetics owned ON owned.cosmetic_id=item.id
 GROUP BY item.id
ON CONFLICT (cosmetic_id) DO NOTHING;

-- Preserve the existing 400-credit full-set price while enabling individual dice
-- purchases. 3 x 150 with 1111 bps discount floors deterministically to 400.
INSERT INTO catalog.cosmetic_pricing(cosmetic_id, pricing_model, fixed_price)
SELECT DISTINCT membership.cosmetic_id, 'fixed', 150
  FROM catalog.offer_items membership
  JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
 WHERE item.slot IN ('dice_attack', 'dice_defense', 'dice_neutral')
   AND item.is_default=FALSE
ON CONFLICT (cosmetic_id) DO NOTHING;

-- Backfill every legacy offer as one stable bundle product.
INSERT INTO catalog.products(
  id,
  collection_id,
  slug,
  name,
  description,
  product_type,
  bundle_discount_bps,
  active
)
SELECT 'product.' || substr(offer.id, 7),
       (
         SELECT MIN(item.collection_id)
           FROM catalog.offer_items membership
           JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
          WHERE membership.offer_id=offer.id
       ),
       offer.slug,
       offer.name,
       offer.description,
       'bundle',
       1111,
       offer.status <> 'retired'
  FROM catalog.offers offer
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.product_items(product_id, cosmetic_id, position)
SELECT 'product.' || substr(membership.offer_id, 7),
       membership.cosmetic_id,
       membership.position
  FROM catalog.offer_items membership
ON CONFLICT (product_id, cosmetic_id) DO NOTHING;

-- Each currently priced cosmetic also becomes independently purchasable.
INSERT INTO catalog.products(
  id,
  collection_id,
  slug,
  name,
  description,
  product_type,
  bundle_discount_bps,
  active
)
SELECT 'product.single.' || item.id,
       item.collection_id,
       item.slug,
       item.name,
       item.description,
       'single',
       0,
       item.status <> 'retired'
  FROM catalog.cosmetics item
  JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
 WHERE item.is_default=FALSE
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.product_items(product_id, cosmetic_id, position)
SELECT 'product.single.' || item.id, item.id, 0
  FROM catalog.cosmetics item
  JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
 WHERE item.is_default=FALSE
ON CONFLICT (product_id, cosmetic_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Offers become availability windows over stable products.
-- ---------------------------------------------------------------------------

ALTER TABLE catalog.offers
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS pricing_model VARCHAR(16) NOT NULL DEFAULT 'itemized',
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

ALTER TABLE catalog.offers
  DROP CONSTRAINT IF EXISTS catalog_offers_product_fkey,
  DROP CONSTRAINT IF EXISTS catalog_offers_pricing_model_check,
  DROP CONSTRAINT IF EXISTS catalog_offers_window_check;

ALTER TABLE catalog.offers
  ADD CONSTRAINT catalog_offers_product_fkey
    FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE RESTRICT,
  ADD CONSTRAINT catalog_offers_pricing_model_check
    CHECK (pricing_model IN ('itemized', 'legacy_fixed')),
  ADD CONSTRAINT catalog_offers_window_check
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);

UPDATE catalog.offers offer
   SET product_id='product.' || substr(offer.id, 7),
       pricing_model='itemized',
       active=(offer.status <> 'retired'),
       priority=offer.sort_order
 WHERE offer.product_id IS NULL;

-- Create individual offers from authoritative per-cosmetic fixed prices.
INSERT INTO catalog.offers(
  id,
  slug,
  name,
  description,
  currency_code,
  price,
  status,
  is_featured,
  sort_order,
  product_id,
  pricing_model,
  starts_at,
  ends_at,
  active,
  priority
)
SELECT 'offer.single.' || item.id,
       'single-' || item.slug,
       item.name,
       item.description,
       'campaign-credit',
       pricing.fixed_price,
       'available',
       FALSE,
       1000 + ROW_NUMBER() OVER (ORDER BY item.id)::int,
       'product.single.' || item.id,
       'itemized',
       NULL,
       NULL,
       TRUE,
       1000 + ROW_NUMBER() OVER (ORDER BY item.id)::int
  FROM catalog.cosmetics item
  JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
 WHERE pricing.pricing_model='fixed'
   AND item.is_default=FALSE
ON CONFLICT (id) DO NOTHING;

-- Keep legacy offer_items synchronized until old readers are removed.
INSERT INTO catalog.offer_items(offer_id, cosmetic_id, position)
SELECT 'offer.single.' || item.id, item.id, 0
  FROM catalog.cosmetics item
  JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
 WHERE item.is_default=FALSE
ON CONFLICT (offer_id, cosmetic_id) DO NOTHING;

ALTER TABLE catalog.offers
  ALTER COLUMN product_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS catalog_offers_product_window_idx
  ON catalog.offers(product_id, active, starts_at, ends_at, priority, id);

-- ---------------------------------------------------------------------------
-- Temporary campaigns are editorial groupings over offers, never ownership.
-- Campaign art remains independent from the closed V1 collection asset contract.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS catalog.campaigns (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT campaigns_window_check
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at),
  CHECK (btrim(id) <> ''),
  CHECK (btrim(slug) <> ''),
  CHECK (btrim(title) <> '')
);

CREATE TABLE IF NOT EXISTS catalog.campaign_assets (
  campaign_id TEXT NOT NULL REFERENCES catalog.campaigns(id) ON DELETE CASCADE,
  role VARCHAR(24) NOT NULL,
  object_key TEXT NOT NULL,
  mime_type VARCHAR(96) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, role),
  CONSTRAINT campaign_assets_role_check
    CHECK (role IN ('hero', 'banner', 'card', 'logo', 'background')),
  CHECK (btrim(object_key) <> ''),
  CHECK (object_key !~ '^[a-z]+://'),
  CHECK (btrim(mime_type) <> '')
);

CREATE TABLE IF NOT EXISTS catalog.campaign_offers (
  campaign_id TEXT NOT NULL REFERENCES catalog.campaigns(id) ON DELETE CASCADE,
  offer_id TEXT NOT NULL REFERENCES catalog.offers(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, offer_id),
  UNIQUE (campaign_id, position),
  CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS catalog_campaigns_window_idx
  ON catalog.campaigns(active, starts_at, ends_at, priority, id);

-- ---------------------------------------------------------------------------
-- Purchase history gains enough snapshots for itemized/completion pricing.
-- Legacy rows remain valid and are conservatively backfilled from what was paid.
-- ---------------------------------------------------------------------------

ALTER TABLE economy.purchases
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS subtotal_price BIGINT,
  ADD COLUMN IF NOT EXISTS discount_bps INTEGER;

ALTER TABLE economy.purchases
  DROP CONSTRAINT IF EXISTS economy_purchases_product_fkey,
  DROP CONSTRAINT IF EXISTS economy_purchases_subtotal_check,
  DROP CONSTRAINT IF EXISTS economy_purchases_discount_check,
  DROP CONSTRAINT IF EXISTS economy_purchases_price_check;

ALTER TABLE economy.purchases
  ADD CONSTRAINT economy_purchases_product_fkey
    FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE RESTRICT,
  ADD CONSTRAINT economy_purchases_subtotal_check
    CHECK (subtotal_price IS NULL OR subtotal_price >= 0),
  ADD CONSTRAINT economy_purchases_discount_check
    CHECK (discount_bps IS NULL OR discount_bps BETWEEN 0 AND 10000),
  ADD CONSTRAINT economy_purchases_price_check CHECK (price_paid >= 0);

UPDATE economy.purchases purchase
   SET product_id=offer.product_id,
       subtotal_price=purchase.price_paid,
       discount_bps=0
  FROM catalog.offers offer
 WHERE offer.id=purchase.offer_id
   AND purchase.product_id IS NULL;

ALTER TABLE economy.purchase_items
  ADD COLUMN IF NOT EXISTS unit_price BIGINT;

ALTER TABLE economy.purchase_items
  DROP CONSTRAINT IF EXISTS economy_purchase_items_unit_price_check;
ALTER TABLE economy.purchase_items
  ADD CONSTRAINT economy_purchase_items_unit_price_check
  CHECK (unit_price IS NULL OR unit_price >= 0);

COMMENT ON TABLE catalog.collections IS
  'Permanent thematic catalogue families. Collections are editorial identity, never owned inventory.';
COMMENT ON TABLE catalog.collection_assets IS
  'Versionable collection merchandising mappings. V1 roles are banner/background/logo and only one active mapping per role is allowed.';
COMMENT ON TABLE catalog.products IS
  'Stable commercial compositions. Single and bundle products grant component cosmetics rather than product ownership.';
COMMENT ON TABLE catalog.cosmetic_pricing IS
  'Authoritative per-cosmetic pricing policy used by individual and completion products.';
COMMENT ON TABLE catalog.price_tiers IS
  'Explicit progressive-price ranges. GiST exclusion prevents overlapping acquisition ranges for one cosmetic.';
COMMENT ON TABLE catalog.cosmetic_stats IS
  'Global acquisition counters used by progressive pricing and locked during authoritative purchase calculation.';
COMMENT ON TABLE catalog.campaigns IS
  'Temporary merchandising/editorial windows independent from permanent collections.';
COMMENT ON COLUMN catalog.collection_assets.object_key IS
  'Exact object-storage key; environment-specific public URLs are resolved outside PostgreSQL.';
COMMENT ON COLUMN catalog.cosmetic_assets.object_key IS
  'Canonical cosmetic object-storage key by semantic render role.';
COMMENT ON COLUMN catalog.offers.product_id IS
  'Stable product exposed through this commercial availability window.';

-- Down Migration
-- Storefront V2 intentionally favors forward fixes after rollout because product,
-- pricing and purchase-history rows may acquire durable user-facing meaning.
