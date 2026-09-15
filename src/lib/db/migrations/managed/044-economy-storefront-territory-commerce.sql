-- Storefront V2 territory commerce: promote the four V1 territory skins into
-- normal single products/offers using the same itemized purchase pipeline.
-- Prices remain catalogue data and can change independently of the frontend.

-- Up Migration

UPDATE catalog.cosmetics
   SET status='available',
       updated_at=NOW()
 WHERE id IN (
   'territory.effect.azulejo-brasil',
   'territory.effect.azulejo-ornamental',
   'territory.effect.ceu-estrelado',
   'territory.effect.solar-ornamental'
 );

INSERT INTO catalog.cosmetic_pricing(cosmetic_id, pricing_model, fixed_price)
SELECT item.id, 'fixed', 300
  FROM catalog.cosmetics item
 WHERE item.id IN (
   'territory.effect.azulejo-brasil',
   'territory.effect.azulejo-ornamental',
   'territory.effect.ceu-estrelado',
   'territory.effect.solar-ornamental'
 )
ON CONFLICT (cosmetic_id) DO UPDATE
SET pricing_model='fixed',
    fixed_price=EXCLUDED.fixed_price,
    updated_at=NOW();

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
       'single-' || item.slug,
       item.name,
       item.description,
       'single',
       0,
       TRUE
  FROM catalog.cosmetics item
 WHERE item.id IN (
   'territory.effect.azulejo-brasil',
   'territory.effect.azulejo-ornamental',
   'territory.effect.ceu-estrelado',
   'territory.effect.solar-ornamental'
 )
ON CONFLICT (id) DO UPDATE
SET collection_id=EXCLUDED.collection_id,
    slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.product_items(product_id, cosmetic_id, position)
SELECT 'product.single.' || item.id, item.id, 0
  FROM catalog.cosmetics item
 WHERE item.id IN (
   'territory.effect.azulejo-brasil',
   'territory.effect.azulejo-ornamental',
   'territory.effect.ceu-estrelado',
   'territory.effect.solar-ornamental'
 )
ON CONFLICT (product_id, cosmetic_id) DO NOTHING;

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
       2000 + ROW_NUMBER() OVER (ORDER BY item.id)::int,
       'product.single.' || item.id,
       'itemized',
       NULL,
       NULL,
       TRUE,
       2000 + ROW_NUMBER() OVER (ORDER BY item.id)::int
  FROM catalog.cosmetics item
  JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
 WHERE item.id IN (
   'territory.effect.azulejo-brasil',
   'territory.effect.azulejo-ornamental',
   'territory.effect.ceu-estrelado',
   'territory.effect.solar-ornamental'
 )
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    currency_code=EXCLUDED.currency_code,
    price=EXCLUDED.price,
    status='available',
    product_id=EXCLUDED.product_id,
    pricing_model='itemized',
    active=TRUE,
    updated_at=NOW();

-- Compatibility for readers still joining catalog.offer_items during rollout.
INSERT INTO catalog.offer_items(offer_id, cosmetic_id, position)
SELECT 'offer.single.' || item.id, item.id, 0
  FROM catalog.cosmetics item
 WHERE item.id IN (
   'territory.effect.azulejo-brasil',
   'territory.effect.azulejo-ornamental',
   'territory.effect.ceu-estrelado',
   'territory.effect.solar-ornamental'
 )
ON CONFLICT (offer_id, cosmetic_id) DO NOTHING;

-- Down Migration
-- Forward fix preferred. Ownership/purchase rows may reference these products and offers.
