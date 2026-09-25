-- Complete storefront offer coverage for source-managed non-default gameplay
-- cosmetics, while deliberately keeping the Brazil dice outside commerce.
--
-- Commercial policy:
--   * collection dice: 500 credits each
--   * standalone dice: 150 credits each
--   * collection territory skins: 500 credits each
--   * standalone territory skins: 300 credits each
--   * collection bundles keep the premium 2000 bps completion discount
--
-- Brazil remains a preserved non-default visual with no product/pricing/offer.
-- Commander titles remain outside this migration.
--
-- Up Migration

-- ---------------------------------------------------------------------------
-- Collections that already have source-managed merchandising assets become
-- first-class active storefront collections.
-- ---------------------------------------------------------------------------

UPDATE catalog.collections
   SET active=TRUE,
       updated_at=NOW()
 WHERE id IN ('collection.dog', 'collection.ceu-noturno');

-- Céu Estrelado is the gameplay territory cosmetic of the Céu Noturno family.
UPDATE catalog.cosmetics
   SET collection_id='collection.ceu-noturno',
       status='available',
       updated_at=NOW()
 WHERE id='territory.effect.ceu-estrelado';

-- Cachorro was intentionally staged as announced/retired. It now launches as
-- the same premium collection shape used by Gato/Viking/Futebol.
UPDATE catalog.cosmetics
   SET collection_id='collection.dog',
       status='available',
       updated_at=NOW()
 WHERE id ~ '^dice\.(attack|defense|neutral)\.cachorro$';

UPDATE catalog.cosmetic_sets
   SET status='available',
       updated_at=NOW()
 WHERE id='set.cachorro';

-- Replace any historical merchandising mapping for these roles with the
-- canonical R2 keys before activating the collections.
UPDATE catalog.collection_assets
   SET active=FALSE,
       updated_at=NOW()
 WHERE collection_id IN ('collection.dog', 'collection.ceu-noturno')
   AND role IN ('banner', 'background', 'logo');

INSERT INTO catalog.collection_assets(
  collection_id, role, object_key, mime_type, active
)
VALUES
  ('collection.dog', 'banner', 'store/collections/dog/banner.webp', 'image/webp', TRUE),
  ('collection.dog', 'background', 'store/collections/dog/background.webp', 'image/webp', TRUE),
  ('collection.dog', 'logo', 'store/collections/dog/logo.webp', 'image/webp', TRUE),
  ('collection.ceu-noturno', 'banner', 'store/collections/ceu-noturno/banner.webp', 'image/webp', TRUE),
  ('collection.ceu-noturno', 'background', 'store/collections/ceu-noturno/background.webp', 'image/webp', TRUE),
  ('collection.ceu-noturno', 'logo', 'store/collections/ceu-noturno/logo.webp', 'image/webp', TRUE)
ON CONFLICT (collection_id, role, object_key) DO UPDATE
SET mime_type=EXCLUDED.mime_type,
    active=TRUE,
    updated_at=NOW();

-- ---------------------------------------------------------------------------
-- Authoritative pricing. Every announced/available non-default gameplay item
-- except Brazil receives pricing. Retired historical Simple Silver rows remain
-- untouched because they are not eligible here.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.cosmetic_pricing(cosmetic_id, pricing_model, fixed_price)
SELECT item.id,
       'fixed',
       CASE
         WHEN item.slot='territory_skin' AND item.collection_id IS NOT NULL THEN 500
         WHEN item.slot='territory_skin' THEN 300
         WHEN item.collection_id IS NOT NULL THEN 500
         ELSE 150
       END
  FROM catalog.cosmetics item
 WHERE item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.id NOT IN (
     'dice.attack.brazil',
     'dice.defense.brazil',
     'dice.neutral.brazil'
   )
ON CONFLICT (cosmetic_id) DO UPDATE
SET pricing_model='fixed',
    fixed_price=EXCLUDED.fixed_price,
    updated_at=NOW();

INSERT INTO catalog.cosmetic_stats(cosmetic_id, acquisition_count)
SELECT item.id,
       COUNT(owned.user_id)::bigint
  FROM catalog.cosmetics item
  LEFT JOIN inventory.cosmetics owned ON owned.cosmetic_id=item.id
 WHERE item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.id NOT IN (
     'dice.attack.brazil',
     'dice.defense.brazil',
     'dice.neutral.brazil'
   )
 GROUP BY item.id
ON CONFLICT (cosmetic_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Stable single products + offers for every eligible gameplay cosmetic.
-- Collection membership on the product mirrors the cosmetic, so collection
-- items participate in the same storefront grouping as existing collections.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.products(
  id, collection_id, slug, name, description,
  product_type, bundle_discount_bps, active
)
SELECT 'product.single.' || item.id,
       item.collection_id,
       'single-' || item.slug,
       item.name,
       item.description,
       'single',
       0,
       TRUE
  FROM catalog.cosmetics item
  JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
 WHERE item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.id NOT IN (
     'dice.attack.brazil',
     'dice.defense.brazil',
     'dice.neutral.brazil'
   )
ON CONFLICT (id) DO UPDATE
SET collection_id=EXCLUDED.collection_id,
    slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    product_type='single',
    bundle_discount_bps=0,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.product_items(product_id, cosmetic_id, position)
SELECT 'product.single.' || item.id,
       item.id,
       0
  FROM catalog.cosmetics item
  JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
 WHERE item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.id NOT IN (
     'dice.attack.brazil',
     'dice.defense.brazil',
     'dice.neutral.brazil'
   )
ON CONFLICT (product_id, cosmetic_id) DO UPDATE
SET position=0;

WITH sellable AS (
  SELECT item.*,
         pricing.fixed_price,
         ROW_NUMBER() OVER (
           ORDER BY
             CASE WHEN item.collection_id IS NULL THEN 0 ELSE 1 END,
             item.collection_id NULLS FIRST,
             item.slot,
             item.id
         )::int AS position
    FROM catalog.cosmetics item
    JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
   WHERE item.is_default=FALSE
     AND item.status IN ('announced','available')
     AND item.id NOT IN (
       'dice.attack.brazil',
       'dice.defense.brazil',
       'dice.neutral.brazil'
     )
)
INSERT INTO catalog.offers(
  id, slug, name, description, currency_code, price,
  status, is_featured, sort_order,
  product_id, pricing_model, starts_at, ends_at, active, priority
)
SELECT 'offer.single.' || item.id,
       'single-' || item.slug,
       item.name,
       item.description,
       'campaign-credit',
       item.fixed_price,
       'available',
       FALSE,
       2000 + item.position,
       'product.single.' || item.id,
       'itemized',
       NULL,
       NULL,
       TRUE,
       2000 + item.position
  FROM sellable item
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    currency_code='campaign-credit',
    price=EXCLUDED.price,
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

-- Compatibility for readers still using catalog.offer_items.
INSERT INTO catalog.offer_items(offer_id, cosmetic_id, position)
SELECT 'offer.single.' || item.id,
       item.id,
       0
  FROM catalog.cosmetics item
  JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
 WHERE item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.id NOT IN (
     'dice.attack.brazil',
     'dice.defense.brazil',
     'dice.neutral.brazil'
   )
ON CONFLICT (offer_id, cosmetic_id) DO UPDATE
SET position=0;

-- ---------------------------------------------------------------------------
-- Cachorro collection bundle: same premium shape as Gato/Viking/Futebol.
-- ---------------------------------------------------------------------------

UPDATE catalog.products
   SET collection_id='collection.dog',
       bundle_discount_bps=2000,
       active=TRUE,
       updated_at=NOW()
 WHERE id='product.cachorro';

UPDATE catalog.offers
   SET price=1200,
       status='available',
       is_featured=FALSE,
       sort_order=130,
       product_id='product.cachorro',
       pricing_model='itemized',
       starts_at=NULL,
       ends_at=NULL,
       active=TRUE,
       priority=130,
       updated_at=NOW()
 WHERE id='offer.cachorro';

-- Keep the premium collection bundle composition canonical.
INSERT INTO catalog.product_items(product_id, cosmetic_id, position)
VALUES
  ('product.cachorro', 'dice.attack.cachorro', 0),
  ('product.cachorro', 'dice.defense.cachorro', 1),
  ('product.cachorro', 'dice.neutral.cachorro', 2)
ON CONFLICT (product_id, cosmetic_id) DO UPDATE
SET position=EXCLUDED.position;

INSERT INTO catalog.offer_items(offer_id, cosmetic_id, position)
VALUES
  ('offer.cachorro', 'dice.attack.cachorro', 0),
  ('offer.cachorro', 'dice.defense.cachorro', 1),
  ('offer.cachorro', 'dice.neutral.cachorro', 2)
ON CONFLICT (offer_id, cosmetic_id) DO UPDATE
SET position=EXCLUDED.position;

-- Brazil stays intentionally non-commercial even though its cosmetics are
-- available and non-default.
DELETE FROM catalog.cosmetic_pricing
 WHERE cosmetic_id IN (
   'dice.attack.brazil',
   'dice.defense.brazil',
   'dice.neutral.brazil'
 );

UPDATE catalog.products
   SET active=FALSE,
       updated_at=NOW()
 WHERE id IN (
   'product.single.dice.attack.brazil',
   'product.single.dice.defense.brazil',
   'product.single.dice.neutral.brazil'
 );

UPDATE catalog.offers
   SET status='retired',
       active=FALSE,
       is_featured=FALSE,
       updated_at=NOW()
 WHERE id IN (
   'offer.single.dice.attack.brazil',
   'offer.single.dice.defense.brazil',
   'offer.single.dice.neutral.brazil'
 );

-- Down Migration
-- Purchase/catalogue rows are durable. Reverse commercial decisions through a
-- forward migration instead of deleting purchase-facing history.
