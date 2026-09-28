-- Add the Gunslinger premium dice-only collection.
--
-- Canonical object-storage prefixes:
--   dice:        cosmetics/dice/gunslinger/
--   collection:  store/collections/gunslinger/
--
-- Gunslinger contains exactly three gameplay dice. Pip presentation is owned by
-- catalog.cosmetic_sets and uses dark + compact rendering.
--
-- Up Migration

-- ---------------------------------------------------------------------------
-- Permanent editorial collection and merchandising assets.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.collections(
  id, slug, name, description, active, sort_order,
  featured, promotion_discount_bps
)
VALUES (
  'collection.gunslinger',
  'gunslinger',
  'Gunslinger',
  'Coleção premium de dados com identidade Gunslinger.',
  TRUE,
  80,
  FALSE,
  0
)
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    active=TRUE,
    sort_order=EXCLUDED.sort_order,
    featured=FALSE,
    promotion_discount_bps=0,
    updated_at=NOW();

UPDATE catalog.collection_assets
   SET active=FALSE,
       updated_at=NOW()
 WHERE collection_id='collection.gunslinger'
   AND role IN ('banner', 'background', 'logo');

INSERT INTO catalog.collection_assets(
  collection_id, role, object_key, mime_type, active
)
VALUES
  ('collection.gunslinger', 'banner', 'store/collections/gunslinger/banner.webp', 'image/webp', TRUE),
  ('collection.gunslinger', 'background', 'store/collections/gunslinger/background.webp', 'image/webp', TRUE),
  ('collection.gunslinger', 'logo', 'store/collections/gunslinger/logo.webp', 'image/webp', TRUE)
ON CONFLICT (collection_id, role, object_key) DO UPDATE
SET mime_type=EXCLUDED.mime_type,
    active=TRUE,
    updated_at=NOW();

-- ---------------------------------------------------------------------------
-- Three canonical dice cosmetics.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.cosmetics(
  id, slug, name, description, slot,
  asset_ref, preview_ref, effect_key, status, is_default, collection_id,
  body_color, body_highlight_color
)
VALUES
  (
    'dice.attack.gunslinger',
    'dado-ataque-gunslinger',
    'Ataque — Gunslinger',
    'Dado ofensivo da coleção Gunslinger.',
    'dice_attack',
    'cosmetics/dice/gunslinger/attack.webp',
    NULL,
    NULL,
    'available',
    FALSE,
    'collection.gunslinger',
    NULL,
    NULL
  ),
  (
    'dice.defense.gunslinger',
    'dado-defesa-gunslinger',
    'Defesa — Gunslinger',
    'Dado defensivo da coleção Gunslinger.',
    'dice_defense',
    'cosmetics/dice/gunslinger/defense.webp',
    NULL,
    NULL,
    'available',
    FALSE,
    'collection.gunslinger',
    NULL,
    NULL
  ),
  (
    'dice.neutral.gunslinger',
    'dado-neutro-gunslinger',
    'Neutro — Gunslinger',
    'Dado neutro da coleção Gunslinger.',
    'dice_neutral',
    'cosmetics/dice/gunslinger/neutral.webp',
    NULL,
    NULL,
    'available',
    FALSE,
    'collection.gunslinger',
    NULL,
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    slot=EXCLUDED.slot,
    asset_ref=EXCLUDED.asset_ref,
    preview_ref=EXCLUDED.preview_ref,
    effect_key=EXCLUDED.effect_key,
    status='available',
    is_default=FALSE,
    collection_id='collection.gunslinger',
    updated_at=NOW();

INSERT INTO catalog.cosmetic_assets(
  cosmetic_id, role, object_key, mime_type, version
)
VALUES
  ('dice.attack.gunslinger', 'primary', 'cosmetics/dice/gunslinger/attack.webp', 'image/webp', 1),
  ('dice.defense.gunslinger', 'primary', 'cosmetics/dice/gunslinger/defense.webp', 'image/webp', 1),
  ('dice.neutral.gunslinger', 'primary', 'cosmetics/dice/gunslinger/neutral.webp', 'image/webp', 1)
ON CONFLICT (cosmetic_id, role) DO UPDATE
SET object_key=EXCLUDED.object_key,
    mime_type=EXCLUDED.mime_type,
    version=GREATEST(catalog.cosmetic_assets.version, EXCLUDED.version),
    updated_at=NOW();

-- ---------------------------------------------------------------------------
-- Visual set: one canonical set for the three Gunslinger dice.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.cosmetic_sets(
  id, slug, storage_slug, name, description, preview_ref,
  status, sort_order, dice_pip_dark, dice_pip_compact
)
VALUES (
  'set.gunslinger',
  'gunslinger',
  'gunslinger',
  'Gunslinger',
  'Trio de dados da coleção Gunslinger.',
  NULL,
  'available',
  80,
  TRUE,
  TRUE
)
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    storage_slug=EXCLUDED.storage_slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    preview_ref=EXCLUDED.preview_ref,
    status='available',
    sort_order=EXCLUDED.sort_order,
    dice_pip_dark=TRUE,
    dice_pip_compact=TRUE,
    updated_at=NOW();

INSERT INTO catalog.cosmetic_set_items(set_id, cosmetic_id, position)
VALUES
  ('set.gunslinger', 'dice.attack.gunslinger', 0),
  ('set.gunslinger', 'dice.defense.gunslinger', 1),
  ('set.gunslinger', 'dice.neutral.gunslinger', 2)
ON CONFLICT (cosmetic_id) DO UPDATE
SET set_id=EXCLUDED.set_id,
    position=EXCLUDED.position;

-- ---------------------------------------------------------------------------
-- Premium dice-only commerce: 500 credits each, 1200 for the complete trio.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.cosmetic_pricing(cosmetic_id, pricing_model, fixed_price)
VALUES
  ('dice.attack.gunslinger', 'fixed', 500),
  ('dice.defense.gunslinger', 'fixed', 500),
  ('dice.neutral.gunslinger', 'fixed', 500)
ON CONFLICT (cosmetic_id) DO UPDATE
SET pricing_model='fixed',
    fixed_price=500,
    updated_at=NOW();

INSERT INTO catalog.cosmetic_stats(cosmetic_id, acquisition_count)
SELECT item.id,
       COUNT(owned.user_id)::bigint
  FROM catalog.cosmetics item
  LEFT JOIN inventory.cosmetics owned ON owned.cosmetic_id=item.id
 WHERE item.id IN (
   'dice.attack.gunslinger',
   'dice.defense.gunslinger',
   'dice.neutral.gunslinger'
 )
 GROUP BY item.id
ON CONFLICT (cosmetic_id) DO NOTHING;

INSERT INTO catalog.products(
  id, collection_id, slug, name, description,
  product_type, bundle_discount_bps, active
)
VALUES
  (
    'product.single.dice.attack.gunslinger',
    'collection.gunslinger',
    'single-dado-ataque-gunslinger',
    'Ataque — Gunslinger',
    'Dado ofensivo da coleção Gunslinger.',
    'single',
    0,
    TRUE
  ),
  (
    'product.single.dice.defense.gunslinger',
    'collection.gunslinger',
    'single-dado-defesa-gunslinger',
    'Defesa — Gunslinger',
    'Dado defensivo da coleção Gunslinger.',
    'single',
    0,
    TRUE
  ),
  (
    'product.single.dice.neutral.gunslinger',
    'collection.gunslinger',
    'single-dado-neutro-gunslinger',
    'Neutro — Gunslinger',
    'Dado neutro da coleção Gunslinger.',
    'single',
    0,
    TRUE
  )
ON CONFLICT (id) DO UPDATE
SET collection_id='collection.gunslinger',
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    product_type='single',
    bundle_discount_bps=0,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.product_items(product_id, cosmetic_id, position)
VALUES
  ('product.single.dice.attack.gunslinger', 'dice.attack.gunslinger', 0),
  ('product.single.dice.defense.gunslinger', 'dice.defense.gunslinger', 0),
  ('product.single.dice.neutral.gunslinger', 'dice.neutral.gunslinger', 0)
ON CONFLICT (product_id, cosmetic_id) DO UPDATE
SET position=0;

-- Modern purchase authority mirrors product_items into generic entitlements.
INSERT INTO catalog.product_entitlements(
  product_id, position, entitlement_kind, cosmetic_id
)
VALUES
  ('product.single.dice.attack.gunslinger', 0, 'game_cosmetic', 'dice.attack.gunslinger'),
  ('product.single.dice.defense.gunslinger', 0, 'game_cosmetic', 'dice.defense.gunslinger'),
  ('product.single.dice.neutral.gunslinger', 0, 'game_cosmetic', 'dice.neutral.gunslinger')
ON CONFLICT (product_id, position) DO UPDATE
SET entitlement_kind='game_cosmetic',
    cosmetic_id=EXCLUDED.cosmetic_id,
    title_id=NULL,
    background_id=NULL,
    battle_pass_season_id=NULL;

INSERT INTO catalog.offers(
  id, slug, name, description, currency_code, price,
  status, is_featured, sort_order,
  product_id, pricing_model, starts_at, ends_at, active, priority
)
VALUES
  (
    'offer.single.dice.attack.gunslinger',
    'single-dado-ataque-gunslinger',
    'Ataque — Gunslinger',
    'Dado ofensivo da coleção Gunslinger.',
    'campaign-credit',
    500,
    'available',
    FALSE,
    2601,
    'product.single.dice.attack.gunslinger',
    'itemized',
    NULL,
    NULL,
    TRUE,
    2601
  ),
  (
    'offer.single.dice.defense.gunslinger',
    'single-dado-defesa-gunslinger',
    'Defesa — Gunslinger',
    'Dado defensivo da coleção Gunslinger.',
    'campaign-credit',
    500,
    'available',
    FALSE,
    2602,
    'product.single.dice.defense.gunslinger',
    'itemized',
    NULL,
    NULL,
    TRUE,
    2602
  ),
  (
    'offer.single.dice.neutral.gunslinger',
    'single-dado-neutro-gunslinger',
    'Neutro — Gunslinger',
    'Dado neutro da coleção Gunslinger.',
    'campaign-credit',
    500,
    'available',
    FALSE,
    2603,
    'product.single.dice.neutral.gunslinger',
    'itemized',
    NULL,
    NULL,
    TRUE,
    2603
  )
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
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
VALUES
  ('offer.single.dice.attack.gunslinger', 'dice.attack.gunslinger', 0),
  ('offer.single.dice.defense.gunslinger', 'dice.defense.gunslinger', 0),
  ('offer.single.dice.neutral.gunslinger', 'dice.neutral.gunslinger', 0)
ON CONFLICT (offer_id, cosmetic_id) DO UPDATE
SET position=0;

INSERT INTO catalog.products(
  id, collection_id, slug, name, description,
  product_type, bundle_discount_bps, active
)
VALUES (
  'product.gunslinger',
  'collection.gunslinger',
  'gunslinger',
  'Gunslinger',
  'Coleção Gunslinger com três dados.',
  'bundle',
  2000,
  TRUE
)
ON CONFLICT (id) DO UPDATE
SET collection_id='collection.gunslinger',
    slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    product_type='bundle',
    bundle_discount_bps=2000,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.product_items(product_id, cosmetic_id, position)
VALUES
  ('product.gunslinger', 'dice.attack.gunslinger', 0),
  ('product.gunslinger', 'dice.defense.gunslinger', 1),
  ('product.gunslinger', 'dice.neutral.gunslinger', 2)
ON CONFLICT (product_id, cosmetic_id) DO UPDATE
SET position=EXCLUDED.position;

INSERT INTO catalog.product_entitlements(
  product_id, position, entitlement_kind, cosmetic_id
)
VALUES
  ('product.gunslinger', 0, 'game_cosmetic', 'dice.attack.gunslinger'),
  ('product.gunslinger', 1, 'game_cosmetic', 'dice.defense.gunslinger'),
  ('product.gunslinger', 2, 'game_cosmetic', 'dice.neutral.gunslinger')
ON CONFLICT (product_id, position) DO UPDATE
SET entitlement_kind='game_cosmetic',
    cosmetic_id=EXCLUDED.cosmetic_id,
    title_id=NULL,
    background_id=NULL,
    battle_pass_season_id=NULL;

INSERT INTO catalog.offers(
  id, slug, name, description, currency_code, price,
  status, is_featured, sort_order,
  product_id, pricing_model, starts_at, ends_at, active, priority
)
VALUES (
  'offer.gunslinger',
  'gunslinger',
  'Gunslinger',
  'Coleção Gunslinger com três dados.',
  'campaign-credit',
  1200,
  'available',
  FALSE,
  170,
  'product.gunslinger',
  'itemized',
  NULL,
  NULL,
  TRUE,
  170
)
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    currency_code='campaign-credit',
    price=1200,
    status='available',
    is_featured=FALSE,
    sort_order=170,
    product_id='product.gunslinger',
    pricing_model='itemized',
    starts_at=NULL,
    ends_at=NULL,
    active=TRUE,
    priority=170,
    updated_at=NOW();

INSERT INTO catalog.offer_items(offer_id, cosmetic_id, position)
VALUES
  ('offer.gunslinger', 'dice.attack.gunslinger', 0),
  ('offer.gunslinger', 'dice.defense.gunslinger', 1),
  ('offer.gunslinger', 'dice.neutral.gunslinger', 2)
ON CONFLICT (offer_id, cosmetic_id) DO UPDATE
SET position=EXCLUDED.position;

-- Down Migration
-- Catalogue and purchase-facing rows are durable. Retire or reprice Gunslinger
-- through a forward migration rather than deleting ownership/history.
