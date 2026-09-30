-- Seed the three Season V1 Battle Pass collections into the Economy V2 catalog.
--
-- Battle Pass role mapping:
--   First Blood -> Free seasonal collection.
--   Alvorada    -> Elite initial collection.
--   Prima Lux   -> Elite final collection.
--
-- This migration seeds catalog/store entities and commerce. It intentionally does
-- not create battle_pass_seasons/rewards: production has no season fixture yet,
-- and V1 activation also requires two explicit commander-title identities.
--
-- Canonical object-storage keys:
--   cosmetics/dice/<slug>/{attack,defense,neutral}.webp
--   cosmetics/territory-skins/<slug>.webp
--   store/collections/<slug>/{banner,background,logo}.webp
--
-- Up Migration

-- ---------------------------------------------------------------------------
-- Collections.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.collections(
  id, slug, name, description, active, sort_order, featured, promotion_discount_bps
)
VALUES
  (
    'collection.first-blood',
    'first-blood',
    'First Blood',
    'Coleção do conjunto Livre da temporada do Passe de Campanha.',
    TRUE, 90, FALSE, 0
  ),
  (
    'collection.alvorada',
    'alvorada',
    'Alvorada',
    'Coleção do conjunto Elite inicial da temporada do Passe de Campanha.',
    TRUE, 100, FALSE, 0
  ),
  (
    'collection.prima-lux',
    'prima-lux',
    'Prima Lux',
    'Coleção do conjunto Elite final da temporada do Passe de Campanha.',
    TRUE, 110, FALSE, 0
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

UPDATE catalog.collection_assets asset
   SET active=FALSE,
       updated_at=NOW()
 WHERE asset.collection_id IN (
   'collection.first-blood',
   'collection.alvorada',
   'collection.prima-lux'
 )
   AND asset.role IN ('banner','background','logo');

INSERT INTO catalog.collection_assets(
  collection_id, role, object_key, mime_type, active
)
VALUES
  ('collection.first-blood', 'banner', 'store/collections/first-blood/banner.webp', 'image/webp', TRUE),
  ('collection.first-blood', 'background', 'store/collections/first-blood/background.webp', 'image/webp', TRUE),
  ('collection.first-blood', 'logo', 'store/collections/first-blood/logo.webp', 'image/webp', TRUE),
  ('collection.alvorada', 'banner', 'store/collections/alvorada/banner.webp', 'image/webp', TRUE),
  ('collection.alvorada', 'background', 'store/collections/alvorada/background.webp', 'image/webp', TRUE),
  ('collection.alvorada', 'logo', 'store/collections/alvorada/logo.webp', 'image/webp', TRUE),
  ('collection.prima-lux', 'banner', 'store/collections/prima-lux/banner.webp', 'image/webp', TRUE),
  ('collection.prima-lux', 'background', 'store/collections/prima-lux/background.webp', 'image/webp', TRUE),
  ('collection.prima-lux', 'logo', 'store/collections/prima-lux/logo.webp', 'image/webp', TRUE)
ON CONFLICT (collection_id, role, object_key) DO UPDATE
SET mime_type='image/webp',
    active=TRUE,
    updated_at=NOW();

-- ---------------------------------------------------------------------------
-- Gameplay entities: 3 dice + 1 territory skin per collection.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.cosmetics(
  id, slug, name, description, slot, rarity,
  asset_ref, preview_ref, effect_key, status, is_default, collection_id,
  body_color, body_highlight_color
)
VALUES
  ('dice.attack.first-blood', 'dado-ataque-first-blood', 'Ataque — First Blood', 'Dado ofensivo da coleção First Blood.', 'dice_attack', NULL, 'cosmetics/dice/first-blood/attack.webp', NULL, NULL, 'available', FALSE, 'collection.first-blood', NULL, NULL),
  ('dice.defense.first-blood', 'dado-defesa-first-blood', 'Defesa — First Blood', 'Dado defensivo da coleção First Blood.', 'dice_defense', NULL, 'cosmetics/dice/first-blood/defense.webp', NULL, NULL, 'available', FALSE, 'collection.first-blood', NULL, NULL),
  ('dice.neutral.first-blood', 'dado-neutro-first-blood', 'Neutro — First Blood', 'Dado neutro da coleção First Blood.', 'dice_neutral', NULL, 'cosmetics/dice/first-blood/neutral.webp', NULL, NULL, 'available', FALSE, 'collection.first-blood', NULL, NULL),
  ('territory.effect.first-blood', 'first-blood', 'Território — First Blood', 'Textura territorial da coleção First Blood.', 'territory_skin', NULL, 'cosmetics/territory-skins/first-blood.webp', NULL, NULL, 'available', FALSE, 'collection.first-blood', NULL, NULL),

  ('dice.attack.alvorada', 'dado-ataque-alvorada', 'Ataque — Alvorada', 'Dado ofensivo da coleção Alvorada.', 'dice_attack', NULL, 'cosmetics/dice/alvorada/attack.webp', NULL, NULL, 'available', FALSE, 'collection.alvorada', NULL, NULL),
  ('dice.defense.alvorada', 'dado-defesa-alvorada', 'Defesa — Alvorada', 'Dado defensivo da coleção Alvorada.', 'dice_defense', NULL, 'cosmetics/dice/alvorada/defense.webp', NULL, NULL, 'available', FALSE, 'collection.alvorada', NULL, NULL),
  ('dice.neutral.alvorada', 'dado-neutro-alvorada', 'Neutro — Alvorada', 'Dado neutro da coleção Alvorada.', 'dice_neutral', NULL, 'cosmetics/dice/alvorada/neutral.webp', NULL, NULL, 'available', FALSE, 'collection.alvorada', NULL, NULL),
  ('territory.effect.alvorada', 'alvorada', 'Território — Alvorada', 'Textura territorial da coleção Alvorada.', 'territory_skin', NULL, 'cosmetics/territory-skins/alvorada.webp', NULL, NULL, 'available', FALSE, 'collection.alvorada', NULL, NULL),

  ('dice.attack.prima-lux', 'dado-ataque-prima-lux', 'Ataque — Prima Lux', 'Dado ofensivo da coleção Prima Lux.', 'dice_attack', NULL, 'cosmetics/dice/prima-lux/attack.webp', NULL, NULL, 'available', FALSE, 'collection.prima-lux', NULL, NULL),
  ('dice.defense.prima-lux', 'dado-defesa-prima-lux', 'Defesa — Prima Lux', 'Dado defensivo da coleção Prima Lux.', 'dice_defense', NULL, 'cosmetics/dice/prima-lux/defense.webp', NULL, NULL, 'available', FALSE, 'collection.prima-lux', NULL, NULL),
  ('dice.neutral.prima-lux', 'dado-neutro-prima-lux', 'Neutro — Prima Lux', 'Dado neutro da coleção Prima Lux.', 'dice_neutral', NULL, 'cosmetics/dice/prima-lux/neutral.webp', NULL, NULL, 'available', FALSE, 'collection.prima-lux', NULL, NULL),
  ('territory.effect.prima-lux', 'prima-lux', 'Território — Prima Lux', 'Textura territorial da coleção Prima Lux.', 'territory_skin', NULL, 'cosmetics/territory-skins/prima-lux.webp', NULL, NULL, 'available', FALSE, 'collection.prima-lux', NULL, NULL)
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
    collection_id=EXCLUDED.collection_id,
    updated_at=NOW();

INSERT INTO catalog.cosmetic_assets(
  cosmetic_id, role, object_key, mime_type, version
)
VALUES
  ('dice.attack.first-blood', 'primary', 'cosmetics/dice/first-blood/attack.webp', 'image/webp', 1),
  ('dice.defense.first-blood', 'primary', 'cosmetics/dice/first-blood/defense.webp', 'image/webp', 1),
  ('dice.neutral.first-blood', 'primary', 'cosmetics/dice/first-blood/neutral.webp', 'image/webp', 1),
  ('territory.effect.first-blood', 'primary', 'cosmetics/territory-skins/first-blood.webp', 'image/webp', 1),

  ('dice.attack.alvorada', 'primary', 'cosmetics/dice/alvorada/attack.webp', 'image/webp', 1),
  ('dice.defense.alvorada', 'primary', 'cosmetics/dice/alvorada/defense.webp', 'image/webp', 1),
  ('dice.neutral.alvorada', 'primary', 'cosmetics/dice/alvorada/neutral.webp', 'image/webp', 1),
  ('territory.effect.alvorada', 'primary', 'cosmetics/territory-skins/alvorada.webp', 'image/webp', 1),

  ('dice.attack.prima-lux', 'primary', 'cosmetics/dice/prima-lux/attack.webp', 'image/webp', 1),
  ('dice.defense.prima-lux', 'primary', 'cosmetics/dice/prima-lux/defense.webp', 'image/webp', 1),
  ('dice.neutral.prima-lux', 'primary', 'cosmetics/dice/prima-lux/neutral.webp', 'image/webp', 1),
  ('territory.effect.prima-lux', 'primary', 'cosmetics/territory-skins/prima-lux.webp', 'image/webp', 1)
ON CONFLICT (cosmetic_id, role) DO UPDATE
SET object_key=EXCLUDED.object_key,
    mime_type='image/webp',
    version=GREATEST(catalog.cosmetic_assets.version, EXCLUDED.version),
    updated_at=NOW();

-- ---------------------------------------------------------------------------
-- Canonical dice sets and pip presentation.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.cosmetic_sets(
  id, slug, storage_slug, name, description, preview_ref,
  status, sort_order, dice_pip_dark, dice_pip_compact
)
VALUES
  ('set.first-blood', 'first-blood', 'first-blood', 'First Blood', 'Trio de dados da coleção First Blood.', NULL, 'available', 90, TRUE, FALSE),
  ('set.alvorada', 'alvorada', 'alvorada', 'Alvorada', 'Trio de dados da coleção Alvorada.', NULL, 'available', 100, TRUE, TRUE),
  ('set.prima-lux', 'prima-lux', 'prima-lux', 'Prima Lux', 'Trio de dados da coleção Prima Lux.', NULL, 'available', 110, FALSE, TRUE)
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    storage_slug=EXCLUDED.storage_slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    preview_ref=EXCLUDED.preview_ref,
    status='available',
    sort_order=EXCLUDED.sort_order,
    dice_pip_dark=EXCLUDED.dice_pip_dark,
    dice_pip_compact=EXCLUDED.dice_pip_compact,
    updated_at=NOW();

INSERT INTO catalog.cosmetic_set_items(set_id, cosmetic_id, position)
VALUES
  ('set.first-blood', 'dice.attack.first-blood', 0),
  ('set.first-blood', 'dice.defense.first-blood', 1),
  ('set.first-blood', 'dice.neutral.first-blood', 2),

  ('set.alvorada', 'dice.attack.alvorada', 0),
  ('set.alvorada', 'dice.defense.alvorada', 1),
  ('set.alvorada', 'dice.neutral.alvorada', 2),

  ('set.prima-lux', 'dice.attack.prima-lux', 0),
  ('set.prima-lux', 'dice.defense.prima-lux', 1),
  ('set.prima-lux', 'dice.neutral.prima-lux', 2)
ON CONFLICT (cosmetic_id) DO UPDATE
SET set_id=EXCLUDED.set_id,
    position=EXCLUDED.position;

-- ---------------------------------------------------------------------------
-- Standard collection commerce: 500 per gameplay item, 20% bundle completion
-- discount, yielding 1600 for a complete four-item collection.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.cosmetic_pricing(cosmetic_id, pricing_model, fixed_price)
SELECT item.id, 'fixed', 500
  FROM catalog.cosmetics item
 WHERE item.collection_id IN (
   'collection.first-blood',
   'collection.alvorada',
   'collection.prima-lux'
 )
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
 WHERE item.collection_id IN (
   'collection.first-blood',
   'collection.alvorada',
   'collection.prima-lux'
 )
   AND item.is_default=FALSE
   AND item.slot IN ('dice_attack','dice_defense','dice_neutral','territory_skin')
 GROUP BY item.id
ON CONFLICT (cosmetic_id) DO NOTHING;

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
 WHERE item.collection_id IN (
   'collection.first-blood',
   'collection.alvorada',
   'collection.prima-lux'
 )
   AND item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.slot IN ('dice_attack','dice_defense','dice_neutral','territory_skin')
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
SELECT 'product.single.' || item.id, item.id, 0
  FROM catalog.cosmetics item
 WHERE item.collection_id IN (
   'collection.first-blood',
   'collection.alvorada',
   'collection.prima-lux'
 )
   AND item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.slot IN ('dice_attack','dice_defense','dice_neutral','territory_skin')
ON CONFLICT (product_id, cosmetic_id) DO UPDATE
SET position=0;

INSERT INTO catalog.product_entitlements(
  product_id, position, entitlement_kind, cosmetic_id,
  title_id, background_id, battle_pass_season_id
)
SELECT 'product.single.' || item.id,
       0,
       'game_cosmetic',
       item.id,
       NULL,
       NULL,
       NULL
  FROM catalog.cosmetics item
 WHERE item.collection_id IN (
   'collection.first-blood',
   'collection.alvorada',
   'collection.prima-lux'
 )
   AND item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.slot IN ('dice_attack','dice_defense','dice_neutral','territory_skin')
ON CONFLICT (product_id, position) DO UPDATE
SET entitlement_kind='game_cosmetic',
    cosmetic_id=EXCLUDED.cosmetic_id,
    title_id=NULL,
    background_id=NULL,
    battle_pass_season_id=NULL;

WITH items AS (
  SELECT item.*,
         CASE item.collection_id
           WHEN 'collection.first-blood' THEN 2700
           WHEN 'collection.alvorada' THEN 2800
           WHEN 'collection.prima-lux' THEN 2900
         END
         + CASE item.slot
             WHEN 'dice_attack' THEN 1
             WHEN 'dice_defense' THEN 2
             WHEN 'dice_neutral' THEN 3
             WHEN 'territory_skin' THEN 4
             ELSE 9
           END AS offer_order
    FROM catalog.cosmetics item
   WHERE item.collection_id IN (
     'collection.first-blood',
     'collection.alvorada',
     'collection.prima-lux'
   )
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
       item.offer_order,
       'product.single.' || item.id,
       'itemized',
       NULL,
       NULL,
       TRUE,
       item.offer_order
  FROM items item
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
SELECT 'offer.single.' || item.id, item.id, 0
  FROM catalog.cosmetics item
 WHERE item.collection_id IN (
   'collection.first-blood',
   'collection.alvorada',
   'collection.prima-lux'
 )
   AND item.is_default=FALSE
   AND item.status IN ('announced','available')
   AND item.slot IN ('dice_attack','dice_defense','dice_neutral','territory_skin')
ON CONFLICT (offer_id, cosmetic_id) DO UPDATE
SET position=0;

INSERT INTO catalog.products(
  id, collection_id, slug, name, description,
  product_type, bundle_discount_bps, active
)
VALUES
  ('product.first-blood', 'collection.first-blood', 'first-blood', 'First Blood', 'Coleção First Blood com três dados e textura territorial.', 'bundle', 2000, TRUE),
  ('product.alvorada', 'collection.alvorada', 'alvorada', 'Alvorada', 'Coleção Alvorada com três dados e textura territorial.', 'bundle', 2000, TRUE),
  ('product.prima-lux', 'collection.prima-lux', 'prima-lux', 'Prima Lux', 'Coleção Prima Lux com três dados e textura territorial.', 'bundle', 2000, TRUE)
ON CONFLICT (id) DO UPDATE
SET collection_id=EXCLUDED.collection_id,
    slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    product_type='bundle',
    bundle_discount_bps=2000,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.product_items(product_id, cosmetic_id, position)
VALUES
  ('product.first-blood', 'dice.attack.first-blood', 0),
  ('product.first-blood', 'dice.defense.first-blood', 1),
  ('product.first-blood', 'dice.neutral.first-blood', 2),
  ('product.first-blood', 'territory.effect.first-blood', 3),

  ('product.alvorada', 'dice.attack.alvorada', 0),
  ('product.alvorada', 'dice.defense.alvorada', 1),
  ('product.alvorada', 'dice.neutral.alvorada', 2),
  ('product.alvorada', 'territory.effect.alvorada', 3),

  ('product.prima-lux', 'dice.attack.prima-lux', 0),
  ('product.prima-lux', 'dice.defense.prima-lux', 1),
  ('product.prima-lux', 'dice.neutral.prima-lux', 2),
  ('product.prima-lux', 'territory.effect.prima-lux', 3)
ON CONFLICT (product_id, cosmetic_id) DO UPDATE
SET position=EXCLUDED.position;

INSERT INTO catalog.product_entitlements(
  product_id, position, entitlement_kind, cosmetic_id,
  title_id, background_id, battle_pass_season_id
)
VALUES
  ('product.first-blood', 0, 'game_cosmetic', 'dice.attack.first-blood', NULL, NULL, NULL),
  ('product.first-blood', 1, 'game_cosmetic', 'dice.defense.first-blood', NULL, NULL, NULL),
  ('product.first-blood', 2, 'game_cosmetic', 'dice.neutral.first-blood', NULL, NULL, NULL),
  ('product.first-blood', 3, 'game_cosmetic', 'territory.effect.first-blood', NULL, NULL, NULL),

  ('product.alvorada', 0, 'game_cosmetic', 'dice.attack.alvorada', NULL, NULL, NULL),
  ('product.alvorada', 1, 'game_cosmetic', 'dice.defense.alvorada', NULL, NULL, NULL),
  ('product.alvorada', 2, 'game_cosmetic', 'dice.neutral.alvorada', NULL, NULL, NULL),
  ('product.alvorada', 3, 'game_cosmetic', 'territory.effect.alvorada', NULL, NULL, NULL),

  ('product.prima-lux', 0, 'game_cosmetic', 'dice.attack.prima-lux', NULL, NULL, NULL),
  ('product.prima-lux', 1, 'game_cosmetic', 'dice.defense.prima-lux', NULL, NULL, NULL),
  ('product.prima-lux', 2, 'game_cosmetic', 'dice.neutral.prima-lux', NULL, NULL, NULL),
  ('product.prima-lux', 3, 'game_cosmetic', 'territory.effect.prima-lux', NULL, NULL, NULL)
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
  ('offer.first-blood', 'first-blood', 'First Blood', 'Coleção First Blood com três dados e textura territorial.', 'campaign-credit', 1600, 'available', FALSE, 180, 'product.first-blood', 'itemized', NULL, NULL, TRUE, 180),
  ('offer.alvorada', 'alvorada', 'Alvorada', 'Coleção Alvorada com três dados e textura territorial.', 'campaign-credit', 1600, 'available', FALSE, 190, 'product.alvorada', 'itemized', NULL, NULL, TRUE, 190),
  ('offer.prima-lux', 'prima-lux', 'Prima Lux', 'Coleção Prima Lux com três dados e textura territorial.', 'campaign-credit', 1600, 'available', FALSE, 200, 'product.prima-lux', 'itemized', NULL, NULL, TRUE, 200)
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    currency_code='campaign-credit',
    price=1600,
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
  ('offer.first-blood', 'dice.attack.first-blood', 0),
  ('offer.first-blood', 'dice.defense.first-blood', 1),
  ('offer.first-blood', 'dice.neutral.first-blood', 2),
  ('offer.first-blood', 'territory.effect.first-blood', 3),

  ('offer.alvorada', 'dice.attack.alvorada', 0),
  ('offer.alvorada', 'dice.defense.alvorada', 1),
  ('offer.alvorada', 'dice.neutral.alvorada', 2),
  ('offer.alvorada', 'territory.effect.alvorada', 3),

  ('offer.prima-lux', 'dice.attack.prima-lux', 0),
  ('offer.prima-lux', 'dice.defense.prima-lux', 1),
  ('offer.prima-lux', 'dice.neutral.prima-lux', 2),
  ('offer.prima-lux', 'territory.effect.prima-lux', 3)
ON CONFLICT (offer_id, cosmetic_id) DO UPDATE
SET position=EXCLUDED.position;

-- ---------------------------------------------------------------------------
-- Equipable profile backgrounds. The product remains collection-independent so
-- collection membership acts as the completion gate rather than promo/lifecycle.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.profile_backgrounds(
  id, slug, name, description, rarity,
  asset_ref, preview_ref, is_default, is_active, collection_id
)
VALUES
  ('profile.background.first-blood', 'first-blood', 'First Blood', 'Background de perfil da coleção First Blood.', 'common', 'store/collections/first-blood/background.webp', 'store/collections/first-blood/background.webp', FALSE, TRUE, 'collection.first-blood'),
  ('profile.background.alvorada', 'alvorada', 'Alvorada', 'Background de perfil da coleção Alvorada.', 'common', 'store/collections/alvorada/background.webp', 'store/collections/alvorada/background.webp', FALSE, TRUE, 'collection.alvorada'),
  ('profile.background.prima-lux', 'prima-lux', 'Prima Lux', 'Background de perfil da coleção Prima Lux.', 'common', 'store/collections/prima-lux/background.webp', 'store/collections/prima-lux/background.webp', FALSE, TRUE, 'collection.prima-lux')
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    rarity=EXCLUDED.rarity,
    asset_ref=EXCLUDED.asset_ref,
    preview_ref=EXCLUDED.preview_ref,
    is_default=FALSE,
    is_active=TRUE,
    collection_id=EXCLUDED.collection_id,
    updated_at=NOW();

INSERT INTO catalog.profile_background_pricing(background_id, fixed_price)
VALUES
  ('profile.background.first-blood', 300),
  ('profile.background.alvorada', 300),
  ('profile.background.prima-lux', 300)
ON CONFLICT (background_id) DO UPDATE
SET fixed_price=300,
    updated_at=NOW();

INSERT INTO catalog.profile_background_stats(background_id, acquisition_count)
SELECT background.id,
       COUNT(owned.user_id)::bigint
  FROM catalog.profile_backgrounds background
  LEFT JOIN profile.commander_backgrounds owned
    ON owned.background_id=background.id
 WHERE background.id IN (
   'profile.background.first-blood',
   'profile.background.alvorada',
   'profile.background.prima-lux'
 )
 GROUP BY background.id
ON CONFLICT (background_id) DO NOTHING;

INSERT INTO catalog.products(
  id, collection_id, slug, name, description,
  product_type, bundle_discount_bps, active
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
 WHERE background.id IN (
   'profile.background.first-blood',
   'profile.background.alvorada',
   'profile.background.prima-lux'
 )
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
  product_id, position, entitlement_kind,
  cosmetic_id, title_id, background_id, battle_pass_season_id
)
SELECT 'product.single.' || background.id,
       0,
       'profile_background',
       NULL,
       NULL,
       background.id,
       NULL
  FROM catalog.profile_backgrounds background
 WHERE background.id IN (
   'profile.background.first-blood',
   'profile.background.alvorada',
   'profile.background.prima-lux'
 )
ON CONFLICT (product_id, position) DO UPDATE
SET entitlement_kind='profile_background',
    cosmetic_id=NULL,
    title_id=NULL,
    background_id=EXCLUDED.background_id,
    battle_pass_season_id=NULL;

WITH backgrounds AS (
  SELECT background.*,
         CASE background.id
           WHEN 'profile.background.first-blood' THEN 3201
           WHEN 'profile.background.alvorada' THEN 3202
           WHEN 'profile.background.prima-lux' THEN 3203
         END AS offer_order
    FROM catalog.profile_backgrounds background
   WHERE background.id IN (
     'profile.background.first-blood',
     'profile.background.alvorada',
     'profile.background.prima-lux'
   )
)
INSERT INTO catalog.offers(
  id, slug, name, description, currency_code, price,
  status, is_featured, sort_order,
  product_id, pricing_model, starts_at, ends_at, active, priority
)
SELECT 'offer.single.' || background.id,
       'profile-background-' || background.slug,
       background.name,
       background.description,
       'campaign-credit',
       300,
       'available',
       FALSE,
       background.offer_order,
       'product.single.' || background.id,
       'itemized',
       NULL,
       NULL,
       TRUE,
       background.offer_order
  FROM backgrounds background
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

-- Battle Pass reward assignment is deliberately deferred until the first
-- battle_pass_season plus its two level-100 commander-title identities exist.
