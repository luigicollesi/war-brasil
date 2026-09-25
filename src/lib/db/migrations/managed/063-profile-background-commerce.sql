-- Sell every active non-default profile background as a permanent single-item
-- campaign-credit offer using the same product/offer/entitlement commerce path as dice.
-- Commander titles intentionally remain outside the paid storefront for now.
--
-- Up Migration

-- ---------------------------------------------------------------------------
-- Background pricing: one authoritative fixed price per active paid background.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.profile_background_pricing(background_id, fixed_price)
SELECT background.id, 300
  FROM catalog.profile_backgrounds background
 WHERE background.is_active=TRUE
   AND background.is_default=FALSE
ON CONFLICT (background_id) DO UPDATE
SET fixed_price=EXCLUDED.fixed_price,
    updated_at=NOW();

INSERT INTO catalog.profile_background_stats(background_id, acquisition_count)
SELECT background.id,
       COUNT(owned.user_id)::bigint
  FROM catalog.profile_backgrounds background
  LEFT JOIN profile.commander_backgrounds owned
    ON owned.background_id=background.id
 WHERE background.is_active=TRUE
   AND background.is_default=FALSE
 GROUP BY background.id
ON CONFLICT (background_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Stable single products. Keep profile backgrounds independent from collection
-- activity so a background can remain purchasable even when its themed collection
-- is not currently being merchandised.
-- ---------------------------------------------------------------------------

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
SELECT 'product.single.' || background.id,
       NULL,
       'profile-background-' || background.slug,
       background.name,
       background.description,
       'single',
       0,
       TRUE
  FROM catalog.profile_backgrounds background
 WHERE background.is_active=TRUE
   AND background.is_default=FALSE
ON CONFLICT (id) DO UPDATE
SET collection_id=NULL,
    slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    product_type='single',
    bundle_discount_bps=0,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.product_entitlements(
  product_id,
  position,
  entitlement_kind,
  cosmetic_id,
  title_id,
  background_id
)
SELECT 'product.single.' || background.id,
       0,
       'profile_background',
       NULL,
       NULL,
       background.id
  FROM catalog.profile_backgrounds background
 WHERE background.is_active=TRUE
   AND background.is_default=FALSE
ON CONFLICT (product_id, position) DO UPDATE
SET entitlement_kind='profile_background',
    cosmetic_id=NULL,
    title_id=NULL,
    background_id=EXCLUDED.background_id;

-- ---------------------------------------------------------------------------
-- Permanent storefront offers, equivalent to single-die offers but backed by
-- profile-background entitlements rather than catalog.product_items.
-- ---------------------------------------------------------------------------

WITH sellable_backgrounds AS (
  SELECT background.*,
         ROW_NUMBER() OVER (ORDER BY background.slug, background.id)::int AS position
    FROM catalog.profile_backgrounds background
   WHERE background.is_active=TRUE
     AND background.is_default=FALSE
)
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
SELECT 'offer.single.' || background.id,
       'profile-background-' || background.slug,
       background.name,
       background.description,
       'campaign-credit',
       300,
       'available',
       FALSE,
       2000 + background.position,
       'product.single.' || background.id,
       'itemized',
       NULL,
       NULL,
       TRUE,
       2000 + background.position
  FROM sellable_backgrounds background
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    currency_code='campaign-credit',
    price=300,
    status='available',
    is_featured=FALSE,
    sort_order=EXCLUDED.sort_order,
    product_id=EXCLUDED.product_id,
    pricing_model='itemized',
    starts_at=NULL,
    ends_at=NULL,
    active=TRUE,
    priority=EXCLUDED.priority,
    updated_at=NOW();

-- Titles are deliberately not paid merchandise yet. If a development database
-- accumulated an experimental title offer, retire only the commercial window;
-- the title, product and ownership records remain intact for future activation.
UPDATE catalog.offers offer
   SET status='retired',
       active=FALSE,
       is_featured=FALSE,
       updated_at=NOW()
 WHERE EXISTS (
   SELECT 1
     FROM catalog.product_entitlements entitlement
    WHERE entitlement.product_id=offer.product_id
      AND entitlement.entitlement_kind='commander_title'
 );

COMMENT ON TABLE catalog.profile_background_pricing IS
  'Fixed campaign-credit prices for purchasable profile backgrounds; active non-default backgrounds launch at 300 credits.';
COMMENT ON TABLE catalog.commander_title_pricing IS
  'Pricing capability for future commander-title commerce; title offers remain retired until explicitly launched.';

-- Down Migration
-- Commercial rows and purchase history can acquire durable user-facing meaning.
-- Reverse this launch only through a forward migration that retires the offers.
