-- Launch catalogue: permanent low-cost dice plus premium themed collections.
-- The migration is data-only and intentionally preserves legacy IDs so purchase
-- history and already-owned cosmetics remain stable.

-- Up Migration

-- ---------------------------------------------------------------------------
-- Simple Silver: low-cost permanent dice, intentionally outside collections.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.cosmetics(
  id, slug, name, description, slot, rarity,
  asset_ref, preview_ref, effect_key, status, is_default, collection_id
)
VALUES
  (
    'dice.attack.simple-silver',
    'dado-ataque-simple-silver',
    'Ataque — Simple Silver',
    'Dado ofensivo comum com acabamento vermelho e bordas prateadas.',
    'dice_attack',
    'common',
    'cosmetics/dice/simple-silver/attack.webp',
    NULL,
    NULL,
    'available',
    FALSE,
    NULL
  ),
  (
    'dice.defense.simple-silver',
    'dado-defesa-simple-silver',
    'Defesa — Simple Silver',
    'Dado defensivo comum com acabamento azul e bordas prateadas.',
    'dice_defense',
    'common',
    'cosmetics/dice/simple-silver/defense.webp',
    NULL,
    NULL,
    'available',
    FALSE,
    NULL
  ),
  (
    'dice.neutral.simple-silver',
    'dado-neutro-simple-silver',
    'Neutro — Simple Silver',
    'Dado neutro comum com acabamento verde e bordas prateadas.',
    'dice_neutral',
    'common',
    'cosmetics/dice/simple-silver/neutral.webp',
    NULL,
    NULL,
    'available',
    FALSE,
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    slot=EXCLUDED.slot,
    rarity=EXCLUDED.rarity,
    asset_ref=EXCLUDED.asset_ref,
    preview_ref=EXCLUDED.preview_ref,
    effect_key=EXCLUDED.effect_key,
    status='available',
    is_default=FALSE,
    collection_id=NULL,
    updated_at=NOW();

INSERT INTO catalog.cosmetic_sets(
  id, slug, storage_slug, name, description, preview_ref, status, sort_order
)
VALUES (
  'set.simple-silver',
  'simple-silver',
  'simple-silver',
  'Simple Silver',
  'Trio permanente de entrada com bordas prateadas e identidade simples.',
  NULL,
  'available',
  5
)
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    storage_slug=EXCLUDED.storage_slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    preview_ref=EXCLUDED.preview_ref,
    status='available',
    sort_order=EXCLUDED.sort_order,
    updated_at=NOW();

INSERT INTO catalog.cosmetic_set_items(set_id, cosmetic_id, position)
VALUES
  ('set.simple-silver', 'dice.attack.simple-silver', 0),
  ('set.simple-silver', 'dice.defense.simple-silver', 1),
  ('set.simple-silver', 'dice.neutral.simple-silver', 2)
ON CONFLICT (set_id, cosmetic_id) DO UPDATE
SET position=EXCLUDED.position;

INSERT INTO catalog.cosmetic_assets(cosmetic_id, role, object_key, mime_type, version)
VALUES
  ('dice.attack.simple-silver', 'primary', 'cosmetics/dice/simple-silver/attack.webp', 'image/webp', 1),
  ('dice.defense.simple-silver', 'primary', 'cosmetics/dice/simple-silver/defense.webp', 'image/webp', 1),
  ('dice.neutral.simple-silver', 'primary', 'cosmetics/dice/simple-silver/neutral.webp', 'image/webp', 1)
ON CONFLICT (cosmetic_id, role) DO UPDATE
SET object_key=EXCLUDED.object_key,
    mime_type=EXCLUDED.mime_type,
    version=GREATEST(catalog.cosmetic_assets.version, EXCLUDED.version),
    updated_at=NOW();

INSERT INTO catalog.cosmetic_stats(cosmetic_id, acquisition_count)
VALUES
  ('dice.attack.simple-silver', 0),
  ('dice.defense.simple-silver', 0),
  ('dice.neutral.simple-silver', 0)
ON CONFLICT (cosmetic_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Launch positioning.
-- Basic sets remain permanent merchandise but are not editorial collections.
-- Cat, Viking and Football are the active premium collection families.
-- Dog remains preserved for a future launch but is not commercially available.
-- ---------------------------------------------------------------------------

UPDATE catalog.cosmetics
   SET collection_id=NULL,
       status='available',
       updated_at=NOW()
 WHERE id ~ '^dice\.(attack|defense|neutral)\.(exercito|lancas|simple-silver)$';

UPDATE catalog.cosmetics
   SET collection_id=CASE
         WHEN id LIKE '%.gato' THEN 'collection.cat'
         WHEN id LIKE '%.viking' THEN 'collection.viking'
         WHEN id LIKE '%.futebol' THEN 'collection.football'
         ELSE collection_id
       END,
       status='available',
       updated_at=NOW()
 WHERE id ~ '^dice\.(attack|defense|neutral)\.(gato|viking|futebol)$';

UPDATE catalog.cosmetics
   SET status='announced',
       updated_at=NOW()
 WHERE id ~ '^dice\.(attack|defense|neutral)\.cachorro$';

UPDATE catalog.cosmetic_sets
   SET status='available',
       sort_order=CASE id
         WHEN 'set.simple-silver' THEN 5
         WHEN 'set.exercito' THEN 10
         WHEN 'set.lancas' THEN 20
         WHEN 'set.gato' THEN 100
         WHEN 'set.viking' THEN 110
         WHEN 'set.futebol' THEN 120
         ELSE sort_order
       END,
       updated_at=NOW()
 WHERE id IN (
   'set.simple-silver', 'set.exercito', 'set.lancas',
   'set.gato', 'set.viking', 'set.futebol'
 );

UPDATE catalog.cosmetic_sets
   SET status='announced',
       updated_at=NOW()
 WHERE id='set.cachorro';

INSERT INTO catalog.collections(id, slug, name, description, active, sort_order)
VALUES
  ('collection.cat', 'cat', 'Gato', 'Coleção premium de dados com identidade felina.', TRUE, 10),
  ('collection.viking', 'viking', 'Viking', 'Coleção premium de dados com identidade nórdica e viking.', TRUE, 20),
  ('collection.football', 'football', 'Futebol', 'Coleção premium de dados inspirada na identidade do futebol.', TRUE, 30)
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    active=TRUE,
    sort_order=EXCLUDED.sort_order,
    updated_at=NOW();

UPDATE catalog.collections
   SET active=FALSE,
       updated_at=NOW()
 WHERE id IN (
   'collection.military-classic',
   'collection.medieval-spears',
   'collection.dog'
 );

-- Collection merchandising uses the closed V1 banner/background/logo contract.
UPDATE catalog.collection_assets
   SET active=FALSE,
       updated_at=NOW()
 WHERE collection_id IN ('collection.cat', 'collection.viking', 'collection.football')
   AND role IN ('banner', 'background', 'logo');

INSERT INTO catalog.collection_assets(
  collection_id, role, object_key, mime_type, active
)
VALUES
  ('collection.cat', 'banner', 'store/collections/cat/banner.webp', 'image/webp', TRUE),
  ('collection.cat', 'background', 'store/collections/cat/background.webp', 'image/webp', TRUE),
  ('collection.cat', 'logo', 'store/collections/cat/logo.webp', 'image/webp', TRUE),
  ('collection.viking', 'banner', 'store/collections/viking/banner.webp', 'image/webp', TRUE),
  ('collection.viking', 'background', 'store/collections/viking/background.webp', 'image/webp', TRUE),
  ('collection.viking', 'logo', 'store/collections/viking/logo.webp', 'image/webp', TRUE),
  ('collection.football', 'banner', 'store/collections/football/banner.webp', 'image/webp', TRUE),
  ('collection.football', 'background', 'store/collections/football/background.webp', 'image/webp', TRUE),
  ('collection.football', 'logo', 'store/collections/football/logo.webp', 'image/webp', TRUE)
ON CONFLICT (collection_id, role, object_key) DO UPDATE
SET mime_type=EXCLUDED.mime_type,
    active=TRUE,
    updated_at=NOW();

-- ---------------------------------------------------------------------------
-- Authoritative fixed pricing.
-- Basics: 150 per die, trio 400 after 1111 bps completion discount.
-- Premium: 500 per die, trio 1200 after 2000 bps completion discount.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.cosmetic_pricing(cosmetic_id, pricing_model, fixed_price)
SELECT item.id,
       'fixed',
       CASE
         WHEN item.id ~ '^dice\.(attack|defense|neutral)\.(gato|viking|futebol)$' THEN 500
         ELSE 150
       END
  FROM catalog.cosmetics item
 WHERE item.id ~ '^dice\.(attack|defense|neutral)\.(simple-silver|exercito|lancas|gato|viking|futebol)$'
ON CONFLICT (cosmetic_id) DO UPDATE
SET pricing_model='fixed',
    fixed_price=EXCLUDED.fixed_price,
    updated_at=NOW();

-- ---------------------------------------------------------------------------
-- Simple Silver stable products/offers. Existing products are updated below.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.products(
  id, collection_id, slug, name, description,
  product_type, bundle_discount_bps, active
)
VALUES (
  'product.simple-silver',
  NULL,
  'simple-silver',
  'Simple Silver',
  'Trio permanente de dados Simple Silver.',
  'bundle',
  1111,
  TRUE
)
ON CONFLICT (id) DO UPDATE
SET collection_id=NULL,
    slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    product_type='bundle',
    bundle_discount_bps=1111,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.product_items(product_id, cosmetic_id, position)
VALUES
  ('product.simple-silver', 'dice.attack.simple-silver', 0),
  ('product.simple-silver', 'dice.defense.simple-silver', 1),
  ('product.simple-silver', 'dice.neutral.simple-silver', 2)
ON CONFLICT (product_id, cosmetic_id) DO UPDATE
SET position=EXCLUDED.position;

INSERT INTO catalog.products(
  id, collection_id, slug, name, description,
  product_type, bundle_discount_bps, active
)
SELECT 'product.single.' || item.id,
       NULL,
       item.slug,
       item.name,
       item.description,
       'single',
       0,
       TRUE
  FROM catalog.cosmetics item
 WHERE item.id ~ '^dice\.(attack|defense|neutral)\.simple-silver$'
ON CONFLICT (id) DO UPDATE
SET collection_id=NULL,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    product_type='single',
    bundle_discount_bps=0,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.product_items(product_id, cosmetic_id, position)
SELECT 'product.single.' || item.id, item.id, 0
  FROM catalog.cosmetics item
 WHERE item.id ~ '^dice\.(attack|defense|neutral)\.simple-silver$'
ON CONFLICT (product_id, cosmetic_id) DO UPDATE
SET position=0;

INSERT INTO catalog.offers(
  id, slug, name, description, currency_code, price,
  status, is_featured, sort_order,
  product_id, pricing_model, starts_at, ends_at, active, priority
)
VALUES (
  'offer.simple-silver',
  'simple-silver',
  'Simple Silver',
  'Trio permanente e acessível de dados Simple Silver.',
  'campaign-credit',
  400,
  'available',
  TRUE,
  5,
  'product.simple-silver',
  'itemized',
  NULL,
  NULL,
  TRUE,
  5
)
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    currency_code='campaign-credit',
    price=400,
    status='available',
    is_featured=TRUE,
    sort_order=5,
    product_id='product.simple-silver',
    pricing_model='itemized',
    starts_at=NULL,
    ends_at=NULL,
    active=TRUE,
    priority=5,
    updated_at=NOW();

INSERT INTO catalog.offer_items(offer_id, cosmetic_id, position)
VALUES
  ('offer.simple-silver', 'dice.attack.simple-silver', 0),
  ('offer.simple-silver', 'dice.defense.simple-silver', 1),
  ('offer.simple-silver', 'dice.neutral.simple-silver', 2)
ON CONFLICT (offer_id, cosmetic_id) DO UPDATE
SET position=EXCLUDED.position;

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
       150,
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
 WHERE item.id ~ '^dice\.(attack|defense|neutral)\.simple-silver$'
ON CONFLICT (id) DO UPDATE
SET name=EXCLUDED.name,
    description=EXCLUDED.description,
    currency_code='campaign-credit',
    price=150,
    status='available',
    product_id=EXCLUDED.product_id,
    pricing_model='itemized',
    starts_at=NULL,
    ends_at=NULL,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.offer_items(offer_id, cosmetic_id, position)
SELECT 'offer.single.' || item.id, item.id, 0
  FROM catalog.cosmetics item
 WHERE item.id ~ '^dice\.(attack|defense|neutral)\.simple-silver$'
ON CONFLICT (offer_id, cosmetic_id) DO UPDATE
SET position=0;

-- ---------------------------------------------------------------------------
-- Normalize existing launch products to their new merchandising tier.
-- ---------------------------------------------------------------------------

UPDATE catalog.products
   SET collection_id=NULL,
       bundle_discount_bps=1111,
       active=TRUE,
       updated_at=NOW()
 WHERE id IN ('product.exercito', 'product.lancas');

UPDATE catalog.products
   SET collection_id=CASE id
         WHEN 'product.gato' THEN 'collection.cat'
         WHEN 'product.viking' THEN 'collection.viking'
         WHEN 'product.futebol' THEN 'collection.football'
       END,
       bundle_discount_bps=2000,
       active=TRUE,
       updated_at=NOW()
 WHERE id IN ('product.gato', 'product.viking', 'product.futebol');

UPDATE catalog.products
   SET active=FALSE,
       updated_at=NOW()
 WHERE id='product.cachorro'
    OR id LIKE 'product.single.dice.%.cachorro';

UPDATE catalog.products product
   SET collection_id=NULL,
       active=TRUE,
       updated_at=NOW()
 WHERE product.id LIKE 'product.single.dice.%.exercito'
    OR product.id LIKE 'product.single.dice.%.lancas';

UPDATE catalog.products product
   SET collection_id=CASE
         WHEN product.id LIKE '%.gato' THEN 'collection.cat'
         WHEN product.id LIKE '%.viking' THEN 'collection.viking'
         WHEN product.id LIKE '%.futebol' THEN 'collection.football'
         ELSE product.collection_id
       END,
       active=TRUE,
       updated_at=NOW()
 WHERE product.id LIKE 'product.single.dice.%.gato'
    OR product.id LIKE 'product.single.dice.%.viking'
    OR product.id LIKE 'product.single.dice.%.futebol';

-- Permanent bundle offers: basic first, premium collections after them.
UPDATE catalog.offers
   SET price=CASE id
         WHEN 'offer.exercito' THEN 400
         WHEN 'offer.lancas' THEN 400
         WHEN 'offer.gato' THEN 1200
         WHEN 'offer.viking' THEN 1200
         WHEN 'offer.futebol' THEN 1200
         ELSE price
       END,
       status='available',
       is_featured=CASE WHEN id='offer.exercito' THEN TRUE ELSE is_featured END,
       sort_order=CASE id
         WHEN 'offer.exercito' THEN 10
         WHEN 'offer.lancas' THEN 20
         WHEN 'offer.gato' THEN 100
         WHEN 'offer.viking' THEN 110
         WHEN 'offer.futebol' THEN 120
         ELSE sort_order
       END,
       starts_at=NULL,
       ends_at=NULL,
       active=TRUE,
       priority=CASE id
         WHEN 'offer.exercito' THEN 10
         WHEN 'offer.lancas' THEN 20
         WHEN 'offer.gato' THEN 100
         WHEN 'offer.viking' THEN 110
         WHEN 'offer.futebol' THEN 120
         ELSE priority
       END,
       updated_at=NOW()
 WHERE id IN ('offer.exercito', 'offer.lancas', 'offer.gato', 'offer.viking', 'offer.futebol');

UPDATE catalog.offers
   SET price=CASE
         WHEN id ~ '\.(gato|viking|futebol)$' THEN 500
         ELSE 150
       END,
       status='available',
       starts_at=NULL,
       ends_at=NULL,
       active=TRUE,
       updated_at=NOW()
 WHERE id ~ '^offer\.single\.dice\.(attack|defense|neutral)\.(exercito|lancas|gato|viking|futebol)$';

UPDATE catalog.offers
   SET status='retired',
       active=FALSE,
       is_featured=FALSE,
       updated_at=NOW()
 WHERE id='offer.cachorro'
    OR id ~ '^offer\.single\.dice\.(attack|defense|neutral)\.cachorro$';

-- Ensure legacy `offers.price` and itemized authoritative pricing agree for launch
-- products. Purchase execution still recomputes from cosmetic_pricing + product
-- discount inside the transaction.
UPDATE catalog.offers offer
   SET price=pricing.fixed_price,
       updated_at=NOW()
  FROM catalog.products product
  JOIN catalog.product_items membership ON membership.product_id=product.id
  JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=membership.cosmetic_id
 WHERE offer.product_id=product.id
   AND product.product_type='single'
   AND offer.active=TRUE
   AND pricing.pricing_model='fixed';

-- Down Migration
-- Launch catalogue rows are durable user-facing commercial data. Rollback should
-- use a forward migration so existing purchase history and ownership remain valid.
