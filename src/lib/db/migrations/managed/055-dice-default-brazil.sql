-- Reclassify the original default dice as Brazil and promote Simple Silver
-- to the canonical default loadout for new commanders.
--
-- Storage contract after this migration:
--   Brazil: cosmetics/dice/brazil/{attack|defense|neutral}.webp
--   Default (Simple Silver art): cosmetics/dice/default/{attack|defense|neutral}.webp
--
-- Existing commanders keep the visual they had equipped: any old default die
-- becomes the corresponding Brazil die. They also retain ownership of the new
-- canonical default because the stable *.default ids remain the bootstrap ids.
--
-- Up Migration

INSERT INTO catalog.cosmetics(
  id,slug,name,description,slot,rarity,asset_ref,preview_ref,effect_key,
  status,is_default,collection_id,body_color,body_highlight_color
)
VALUES
  (
    'dice.attack.brazil',
    'dado-ataque-brazil',
    'Ataque — Brazil',
    'Visual Brazil do dado ofensivo.',
    'dice_attack',
    NULL,
    'cosmetics/dice/brazil/attack.webp',
    NULL,
    NULL,
    'available',
    FALSE,
    NULL,
    '#BB7807',
    NULL
  ),
  (
    'dice.defense.brazil',
    'dado-defesa-brazil',
    'Defesa — Brazil',
    'Visual Brazil do dado defensivo.',
    'dice_defense',
    NULL,
    'cosmetics/dice/brazil/defense.webp',
    NULL,
    NULL,
    'available',
    FALSE,
    NULL,
    '#BB7807',
    NULL
  ),
  (
    'dice.neutral.brazil',
    'dado-neutro-brazil',
    'Neutro — Brazil',
    'Visual Brazil para iniciativa e rolagens neutras.',
    'dice_neutral',
    NULL,
    'cosmetics/dice/brazil/neutral.webp',
    NULL,
    NULL,
    'available',
    FALSE,
    NULL,
    '#BB7807',
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    rarity=EXCLUDED.rarity,
    asset_ref=EXCLUDED.asset_ref,
    preview_ref=EXCLUDED.preview_ref,
    effect_key=EXCLUDED.effect_key,
    status=EXCLUDED.status,
    is_default=FALSE,
    collection_id=NULL,
    body_color=EXCLUDED.body_color,
    body_highlight_color=EXCLUDED.body_highlight_color,
    updated_at=NOW();

INSERT INTO catalog.cosmetic_assets(
  cosmetic_id,role,object_key,mime_type,version
)
VALUES
  ('dice.attack.brazil','primary','cosmetics/dice/brazil/attack.webp','image/webp',1),
  ('dice.defense.brazil','primary','cosmetics/dice/brazil/defense.webp','image/webp',1),
  ('dice.neutral.brazil','primary','cosmetics/dice/brazil/neutral.webp','image/webp',1)
ON CONFLICT (cosmetic_id,role) DO UPDATE
SET object_key=EXCLUDED.object_key,
    mime_type=EXCLUDED.mime_type,
    updated_at=NOW();

-- Preserve the semantic identity of the old default for current owners before
-- the stable *.default ids are repurposed below.
INSERT INTO inventory.cosmetics(
  user_id,cosmetic_id,slot,acquisition_source,acquired_at
)
SELECT owned.user_id,
       CASE owned.slot
         WHEN 'dice_attack' THEN 'dice.attack.brazil'
         WHEN 'dice_defense' THEN 'dice.defense.brazil'
         WHEN 'dice_neutral' THEN 'dice.neutral.brazil'
       END,
       owned.slot,
       owned.acquisition_source,
       owned.acquired_at
  FROM inventory.cosmetics owned
 WHERE owned.cosmetic_id IN (
   'dice.attack.default',
   'dice.defense.default',
   'dice.neutral.default'
 )
ON CONFLICT (user_id,cosmetic_id) DO NOTHING;

UPDATE profile.cosmetic_loadout
   SET cosmetic_id=CASE slot
         WHEN 'dice_attack' THEN 'dice.attack.brazil'
         WHEN 'dice_defense' THEN 'dice.defense.brazil'
         WHEN 'dice_neutral' THEN 'dice.neutral.brazil'
       END,
       updated_at=NOW()
 WHERE cosmetic_id IN (
   'dice.attack.default',
   'dice.defense.default',
   'dice.neutral.default'
 );

-- Simple Silver is no longer merchandise: it becomes the canonical built-in
-- default. Keep the legacy catalog/store records retired for referential safety.
UPDATE catalog.offers
   SET status='retired',
       active=FALSE,
       is_featured=FALSE,
       updated_at=NOW()
 WHERE id LIKE '%simple-silver%';

UPDATE catalog.products
   SET active=FALSE,
       updated_at=NOW()
 WHERE id LIKE '%simple-silver%';

UPDATE catalog.cosmetic_sets
   SET status='retired',
       updated_at=NOW()
 WHERE id='set.simple-silver';

UPDATE catalog.cosmetics
   SET status='retired',
       is_default=FALSE,
       updated_at=NOW()
 WHERE id IN (
   'dice.attack.simple-silver',
   'dice.defense.simple-silver',
   'dice.neutral.simple-silver'
 );

-- The stable *.default ids now represent the Simple Silver art and remain the
-- only default dice selected by economy initialization.
UPDATE catalog.cosmetics
   SET name=CASE slot
         WHEN 'dice_attack' THEN 'Dado de Ataque Padrão'
         WHEN 'dice_defense' THEN 'Dado de Defesa Padrão'
         WHEN 'dice_neutral' THEN 'Dado Neutro Padrão'
       END,
       description=CASE slot
         WHEN 'dice_attack' THEN 'Dado ofensivo padrão com acabamento vermelho e bordas prateadas.'
         WHEN 'dice_defense' THEN 'Dado defensivo padrão com acabamento azul e bordas prateadas.'
         WHEN 'dice_neutral' THEN 'Dado neutro padrão com acabamento verde e bordas prateadas.'
       END,
       rarity='common',
       asset_ref=CASE slot
         WHEN 'dice_attack' THEN 'cosmetics/dice/default/attack.webp'
         WHEN 'dice_defense' THEN 'cosmetics/dice/default/defense.webp'
         WHEN 'dice_neutral' THEN 'cosmetics/dice/default/neutral.webp'
       END,
       preview_ref=NULL,
       effect_key=NULL,
       status='available',
       is_default=TRUE,
       collection_id=NULL,
       body_color='#C4C6CB',
       body_highlight_color=NULL,
       updated_at=NOW()
 WHERE id IN (
   'dice.attack.default',
   'dice.defense.default',
   'dice.neutral.default'
 );

UPDATE catalog.cosmetic_assets
   SET object_key=CASE cosmetic_id
         WHEN 'dice.attack.default' THEN 'cosmetics/dice/default/attack.webp'
         WHEN 'dice.defense.default' THEN 'cosmetics/dice/default/defense.webp'
         WHEN 'dice.neutral.default' THEN 'cosmetics/dice/default/neutral.webp'
       END,
       mime_type='image/webp',
       version=GREATEST(version + 1, 2),
       updated_at=NOW()
 WHERE cosmetic_id IN (
   'dice.attack.default',
   'dice.defense.default',
   'dice.neutral.default'
 )
   AND role='primary';

-- Every existing commander owns the new canonical default.
INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
SELECT commander.user_id,item.id,item.slot,'default'
  FROM profile.commanders commander
 CROSS JOIN catalog.cosmetics item
 WHERE item.is_default=TRUE
   AND item.slot IN ('dice_attack','dice_defense','dice_neutral')
ON CONFLICT (user_id,cosmetic_id) DO NOTHING;

-- If Simple Silver was ever equipped before retirement, resolve it to the new
-- canonical default ids.
UPDATE profile.cosmetic_loadout
   SET cosmetic_id=CASE slot
         WHEN 'dice_attack' THEN 'dice.attack.default'
         WHEN 'dice_defense' THEN 'dice.defense.default'
         WHEN 'dice_neutral' THEN 'dice.neutral.default'
       END,
       updated_at=NOW()
 WHERE cosmetic_id IN (
   'dice.attack.simple-silver',
   'dice.defense.simple-silver',
   'dice.neutral.simple-silver'
 );

-- Reconcile catalog stats with real ownership after the migration.
INSERT INTO catalog.cosmetic_stats(cosmetic_id,acquisition_count,updated_at)
SELECT item.id,
       COUNT(owned.user_id)::bigint,
       NOW()
  FROM catalog.cosmetics item
  LEFT JOIN inventory.cosmetics owned ON owned.cosmetic_id=item.id
 WHERE item.id IN (
   'dice.attack.default','dice.defense.default','dice.neutral.default',
   'dice.attack.brazil','dice.defense.brazil','dice.neutral.brazil',
   'dice.attack.simple-silver','dice.defense.simple-silver','dice.neutral.simple-silver'
 )
 GROUP BY item.id
ON CONFLICT (cosmetic_id) DO UPDATE
SET acquisition_count=EXCLUDED.acquisition_count,
    updated_at=NOW();

INSERT INTO ops.pgmigrations(name)
VALUES('055-dice-default-brazil.sql')
ON CONFLICT (name) DO NOTHING;

-- Down Migration
-- Forward corrections are preferred because ownership/loadout history is durable.
