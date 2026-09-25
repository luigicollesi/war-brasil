-- Add the missing gameplay cosmetics for the canonical Céu Noturno collection
-- and expose them through the same premium collection commerce model used by
-- Gato, Viking, Futebol and Cachorro.
--
-- Canonical identity:
--   collection: collection.ceu-noturno
--   storage slug: ceu-noturno
--   dice: cosmetics/dice/ceu-noturno/{attack|defense|neutral}.webp
--
-- Brazil remains intentionally outside paid commerce.
--
-- Up Migration

INSERT INTO catalog.cosmetics(
  id, slug, name, description, slot, rarity,
  asset_ref, preview_ref, effect_key, status, is_default, collection_id
)
VALUES
  (
    'dice.attack.ceu-noturno',
    'dado-ataque-ceu-noturno',
    'Ataque — Céu Noturno',
    'Dado ofensivo da coleção Céu Noturno.',
    'dice_attack',
    'rare',
    'cosmetics/dice/ceu-noturno/attack.webp',
    NULL,
    NULL,
    'available',
    FALSE,
    'collection.ceu-noturno'
  ),
  (
    'dice.defense.ceu-noturno',
    'dado-defesa-ceu-noturno',
    'Defesa — Céu Noturno',
    'Dado defensivo da coleção Céu Noturno.',
    'dice_defense',
    'rare',
    'cosmetics/dice/ceu-noturno/defense.webp',
    NULL,
    NULL,
    'available',
    FALSE,
    'collection.ceu-noturno'
  ),
  (
    'dice.neutral.ceu-noturno',
    'dado-neutro-ceu-noturno',
    'Neutro — Céu Noturno',
    'Dado neutro da coleção Céu Noturno.',
    'dice_neutral',
    'rare',
    'cosmetics/dice/ceu-noturno/neutral.webp',
    NULL,
    NULL,
    'available',
    FALSE,
    'collection.ceu-noturno'
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
    collection_id='collection.ceu-noturno',
    updated_at=NOW();

INSERT INTO catalog.cosmetic_assets(cosmetic_id, role, object_key, mime_type, version)
VALUES
  ('dice.attack.ceu-noturno', 'primary', 'cosmetics/dice/ceu-noturno/attack.webp', 'image/webp', 1),
  ('dice.defense.ceu-noturno', 'primary', 'cosmetics/dice/ceu-noturno/defense.webp', 'image/webp', 1),
  ('dice.neutral.ceu-noturno', 'primary', 'cosmetics/dice/ceu-noturno/neutral.webp', 'image/webp', 1)
ON CONFLICT (cosmetic_id, role) DO UPDATE
SET object_key=EXCLUDED.object_key,
    mime_type=EXCLUDED.mime_type,
    version=GREATEST(catalog.cosmetic_assets.version, EXCLUDED.version),
    updated_at=NOW();

-- Ensure the territory skin belongs to the same canonical collection.
UPDATE catalog.cosmetics
   SET collection_id='collection.ceu-noturno',
       status='available',
       updated_at=NOW()
 WHERE id='territory.effect.ceu-estrelado';

-- Premium collection pricing: every gameplay cosmetic in the collection is 500.
INSERT INTO catalog.cosmetic_pricing(cosmetic_id, pricing_model, fixed_price)
SELECT item.id, 'fixed', 500
  FROM catalog.cosmetics item
 WHERE item.collection_id='collection.ceu-noturno'
   AND item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.slot IN ('dice_attack','dice_defense','dice_neutral','territory_skin')
ON CONFLICT (cosmetic_id) DO UPDATE
SET pricing_model='fixed',
    fixed_price=500,
    updated_at=NOW();

INSERT INTO catalog.cosmetic_stats(cosmetic_id, acquisition_count)
SELECT item.id,
       COUNT(owned.user_id)::bigint
  FROM catalog.cosmetics item
  LEFT JOIN inventory.cosmetics owned ON owned.cosmetic_id=item.id
 WHERE item.collection_id='collection.ceu-noturno'
   AND item.is_default=FALSE
   AND item.slot IN ('dice_attack','dice_defense','dice_neutral','territory_skin')
 GROUP BY item.id
ON CONFLICT (cosmetic_id) DO NOTHING;

-- Individual products/offers for every gameplay item in Céu Noturno.
INSERT INTO catalog.products(
  id, collection_id, slug, name, description,
  product_type, bundle_discount_bps, active
)
SELECT 'product.single.' || item.id,
       'collection.ceu-noturno',
       'single-' || item.slug,
       item.name,
       item.description,
       'single',
       0,
       TRUE
  FROM catalog.cosmetics item
 WHERE item.collection_id='collection.ceu-noturno'
   AND item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.slot IN ('dice_attack','dice_defense','dice_neutral','territory_skin')
ON CONFLICT (id) DO UPDATE
SET collection_id='collection.ceu-noturno',
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    product_type='single',
    bundle_discount_bps=0,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.product_items(product_id, cosmetic_id, position)
SELECT 'product.single.' || item.id, item.id, 0
  FROM catalog.cosmetics item
 WHERE item.collection_id='collection.ceu-noturno'
   AND item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.slot IN ('dice_attack','dice_defense','dice_neutral','territory_skin')
ON CONFLICT (product_id, cosmetic_id) DO UPDATE
SET position=0;

WITH items AS (
  SELECT item.*,
         ROW_NUMBER() OVER (
           ORDER BY CASE item.slot
             WHEN 'dice_attack' THEN 10
             WHEN 'dice_defense' THEN 20
             WHEN 'dice_neutral' THEN 30
             WHEN 'territory_skin' THEN 40
             ELSE 99
           END,
           item.id
         )::int AS position
    FROM catalog.cosmetics item
   WHERE item.collection_id='collection.ceu-noturno'
     AND item.is_default=FALSE
     AND item.status IN ('announced','available')
     AND item.slot IN ('dice_attack','dice_defense','dice_neutral','territory_skin')
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
       500,
       'available',
       FALSE,
       2400 + item.position,
       'product.single.' || item.id,
       'itemized',
       NULL,
       NULL,
       TRUE,
       2400 + item.position
  FROM items item
ON CONFLICT (id) DO UPDATE
SET name=EXCLUDED.name,
    description=EXCLUDED.description,
    currency_code='campaign-credit',
    price=500,
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

INSERT INTO catalog.offer_items(offer_id, cosmetic_id, position)
SELECT 'offer.single.' || item.id, item.id, 0
  FROM catalog.cosmetics item
 WHERE item.collection_id='collection.ceu-noturno'
   AND item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.slot IN ('dice_attack','dice_defense','dice_neutral','territory_skin')
ON CONFLICT (offer_id, cosmetic_id) DO UPDATE
SET position=0;

-- Collection bundle: 3 dice + territory texture. Base subtotal is 2000 and the
-- same 20% premium-collection completion discount yields 1600 credits.
INSERT INTO catalog.products(
  id, collection_id, slug, name, description,
  product_type, bundle_discount_bps, active
)
VALUES (
  'product.ceu-noturno',
  'collection.ceu-noturno',
  'ceu-noturno',
  'Céu Noturno',
  'Coleção Céu Noturno com três dados e textura territorial.',
  'bundle',
  2000,
  TRUE
)
ON CONFLICT (id) DO UPDATE
SET collection_id='collection.ceu-noturno',
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    product_type='bundle',
    bundle_discount_bps=2000,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.product_items(product_id, cosmetic_id, position)
VALUES
  ('product.ceu-noturno', 'dice.attack.ceu-noturno', 0),
  ('product.ceu-noturno', 'dice.defense.ceu-noturno', 1),
  ('product.ceu-noturno', 'dice.neutral.ceu-noturno', 2),
  ('product.ceu-noturno', 'territory.effect.ceu-estrelado', 3)
ON CONFLICT (product_id, cosmetic_id) DO UPDATE
SET position=EXCLUDED.position;

INSERT INTO catalog.offers(
  id, slug, name, description, currency_code, price,
  status, is_featured, sort_order,
  product_id, pricing_model, starts_at, ends_at, active, priority
)
VALUES (
  'offer.ceu-noturno',
  'ceu-noturno',
  'Céu Noturno',
  'Coleção Céu Noturno com três dados e textura territorial.',
  'campaign-credit',
  1600,
  'available',
  FALSE,
  140,
  'product.ceu-noturno',
  'itemized',
  NULL,
  NULL,
  TRUE,
  140
)
ON CONFLICT (id) DO UPDATE
SET name=EXCLUDED.name,
    description=EXCLUDED.description,
    currency_code='campaign-credit',
    price=1600,
    status='available',
    is_featured=FALSE,
    sort_order=140,
    product_id='product.ceu-noturno',
    pricing_model='itemized',
    starts_at=NULL,
    ends_at=NULL,
    active=TRUE,
    priority=140,
    updated_at=NOW();

INSERT INTO catalog.offer_items(offer_id, cosmetic_id, position)
VALUES
  ('offer.ceu-noturno', 'dice.attack.ceu-noturno', 0),
  ('offer.ceu-noturno', 'dice.defense.ceu-noturno', 1),
  ('offer.ceu-noturno', 'dice.neutral.ceu-noturno', 2),
  ('offer.ceu-noturno', 'territory.effect.ceu-estrelado', 3)
ON CONFLICT (offer_id, cosmetic_id) DO UPDATE
SET position=EXCLUDED.position;

-- Down Migration
-- Store commerce and ownership are durable. Use a forward migration to retire or
-- reprice these offers rather than deleting historical rows.
