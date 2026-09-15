-- Move dice catalog references from local SVG paths to stable Cloudflare R2 WebP object keys.
-- PostgreSQL remains the catalog authority; object storage contains only bytes.

-- Up Migration

ALTER TABLE catalog.cosmetic_sets
  ADD COLUMN IF NOT EXISTS storage_slug TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE catalog.cosmetic_sets
  DROP CONSTRAINT IF EXISTS cosmetic_sets_storage_slug_check;
ALTER TABLE catalog.cosmetic_sets
  ADD CONSTRAINT cosmetic_sets_storage_slug_check
  CHECK (
    storage_slug IS NULL
    OR storage_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS cosmetic_sets_storage_slug_uidx
  ON catalog.cosmetic_sets(storage_slug)
  WHERE storage_slug IS NOT NULL;

INSERT INTO catalog.cosmetics(
  id, slug, name, description, slot, rarity, asset_ref, preview_ref, effect_key, status, is_default
)
VALUES
  ('dice.attack.default', 'dado-ataque-padrao', 'Dado de Ataque Padrão', 'Visual padrão do dado ofensivo.', 'dice_attack', NULL, 'cosmetics/dice/default/attack.webp', NULL, NULL, 'available', TRUE),
  ('dice.defense.default', 'dado-defesa-padrao', 'Dado de Defesa Padrão', 'Visual padrão do dado defensivo.', 'dice_defense', NULL, 'cosmetics/dice/default/defense.webp', NULL, NULL, 'available', TRUE),
  ('dice.neutral.default', 'dado-neutro-padrao', 'Dado Neutro Padrão', 'Visual padrão para iniciativa e rolagens neutras.', 'dice_neutral', NULL, 'cosmetics/dice/default/neutral.webp', NULL, NULL, 'available', TRUE),

  ('dice.attack.exercito', 'dado-ataque-exercito', 'Ataque — Exército Clássico', 'Dado ofensivo da remessa Exército Clássico.', 'dice_attack', NULL, 'cosmetics/dice/military-classic/attack.webp', NULL, NULL, 'announced', FALSE),
  ('dice.defense.exercito', 'dado-defesa-exercito', 'Defesa — Exército Clássico', 'Dado defensivo da remessa Exército Clássico.', 'dice_defense', NULL, 'cosmetics/dice/military-classic/defense.webp', NULL, NULL, 'announced', FALSE),
  ('dice.neutral.exercito', 'dado-neutro-exercito', 'Neutro — Exército Clássico', 'Dado neutro da remessa Exército Clássico.', 'dice_neutral', NULL, 'cosmetics/dice/military-classic/neutral.webp', NULL, NULL, 'announced', FALSE),

  ('dice.attack.lancas', 'dado-ataque-lancas', 'Ataque — Lanças Medievais', 'Dado ofensivo da remessa Lanças Medievais.', 'dice_attack', NULL, 'cosmetics/dice/medieval-spears/attack.webp', NULL, NULL, 'announced', FALSE),
  ('dice.defense.lancas', 'dado-defesa-lancas', 'Defesa — Lanças Medievais', 'Dado defensivo da remessa Lanças Medievais.', 'dice_defense', NULL, 'cosmetics/dice/medieval-spears/defense.webp', NULL, NULL, 'announced', FALSE),
  ('dice.neutral.lancas', 'dado-neutro-lancas', 'Neutro — Lanças Medievais', 'Dado neutro da remessa Lanças Medievais.', 'dice_neutral', NULL, 'cosmetics/dice/medieval-spears/neutral.webp', NULL, NULL, 'announced', FALSE),

  ('dice.attack.viking', 'dado-ataque-viking', 'Ataque — Viking', 'Dado ofensivo da remessa Viking.', 'dice_attack', NULL, 'cosmetics/dice/viking/attack.webp', NULL, NULL, 'announced', FALSE),
  ('dice.defense.viking', 'dado-defesa-viking', 'Defesa — Viking', 'Dado defensivo da remessa Viking.', 'dice_defense', NULL, 'cosmetics/dice/viking/defense.webp', NULL, NULL, 'announced', FALSE),
  ('dice.neutral.viking', 'dado-neutro-viking', 'Neutro — Viking', 'Dado neutro da remessa Viking.', 'dice_neutral', NULL, 'cosmetics/dice/viking/neutral.webp', NULL, NULL, 'announced', FALSE),

  ('dice.attack.gato', 'dado-ataque-gato', 'Ataque — Gato', 'Dado ofensivo da remessa Gato, com identidade felina e visual leve.', 'dice_attack', NULL, 'cosmetics/dice/cat/attack.webp', NULL, NULL, 'announced', FALSE),
  ('dice.defense.gato', 'dado-defesa-gato', 'Defesa — Gato', 'Dado defensivo da remessa Gato, com identidade felina e visual leve.', 'dice_defense', NULL, 'cosmetics/dice/cat/defense.webp', NULL, NULL, 'announced', FALSE),
  ('dice.neutral.gato', 'dado-neutro-gato', 'Neutro — Gato', 'Dado neutro da remessa Gato, com identidade felina e visual leve.', 'dice_neutral', NULL, 'cosmetics/dice/cat/neutral.webp', NULL, NULL, 'announced', FALSE),

  ('dice.attack.cachorro', 'dado-ataque-cachorro', 'Ataque — Cachorro', 'Dado ofensivo da remessa Cachorro, com estética amigável e temática canina.', 'dice_attack', NULL, 'cosmetics/dice/dog/attack.webp', NULL, NULL, 'announced', FALSE),
  ('dice.defense.cachorro', 'dado-defesa-cachorro', 'Defesa — Cachorro', 'Dado defensivo da remessa Cachorro, com estética amigável e temática canina.', 'dice_defense', NULL, 'cosmetics/dice/dog/defense.webp', NULL, NULL, 'announced', FALSE),
  ('dice.neutral.cachorro', 'dado-neutro-cachorro', 'Neutro — Cachorro', 'Dado neutro da remessa Cachorro, com estética amigável e temática canina.', 'dice_neutral', NULL, 'cosmetics/dice/dog/neutral.webp', NULL, NULL, 'announced', FALSE),

  ('dice.attack.futebol', 'dado-ataque-futebol', 'Ataque — Futebol', 'Dado ofensivo da remessa Futebol, inspirado na identidade do esporte brasileiro.', 'dice_attack', NULL, 'cosmetics/dice/football/attack.webp', NULL, NULL, 'announced', FALSE),
  ('dice.defense.futebol', 'dado-defesa-futebol', 'Defesa — Futebol', 'Dado defensivo da remessa Futebol, inspirado na identidade do esporte brasileiro.', 'dice_defense', NULL, 'cosmetics/dice/football/defense.webp', NULL, NULL, 'announced', FALSE),
  ('dice.neutral.futebol', 'dado-neutro-futebol', 'Neutro — Futebol', 'Dado neutro da remessa Futebol, inspirado na identidade do esporte brasileiro.', 'dice_neutral', NULL, 'cosmetics/dice/football/neutral.webp', NULL, NULL, 'announced', FALSE)
ON CONFLICT (id) DO UPDATE
SET slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    slot = EXCLUDED.slot,
    rarity = EXCLUDED.rarity,
    asset_ref = EXCLUDED.asset_ref,
    preview_ref = EXCLUDED.preview_ref,
    effect_key = EXCLUDED.effect_key,
    status = EXCLUDED.status,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();

INSERT INTO catalog.cosmetic_sets(
  id, slug, storage_slug, name, description, preview_ref, status, sort_order
)
VALUES
  ('set.exercito', 'exercito-classico', 'military-classic', 'Exército Clássico', 'Remessa de dados com estética militar clássica.', NULL, 'announced', 10),
  ('set.lancas', 'lancas-medievais', 'medieval-spears', 'Lanças Medievais', 'Remessa de dados inspirada em lanças e armamentos medievais.', NULL, 'announced', 20),
  ('set.viking', 'viking', 'viking', 'Viking', 'Remessa de dados com estética nórdica e viking.', NULL, 'announced', 30),
  ('set.gato', 'gato', 'cat', 'Gato', 'Remessa de dados com estética felina, leve e divertida.', NULL, 'announced', 40),
  ('set.cachorro', 'cachorro', 'dog', 'Cachorro', 'Remessa de dados com estética canina, amigável e descontraída.', NULL, 'announced', 50),
  ('set.futebol', 'futebol', 'football', 'Futebol', 'Remessa de dados inspirada na paixão e identidade visual do futebol.', NULL, 'announced', 60)
ON CONFLICT (id) DO UPDATE
SET slug = EXCLUDED.slug,
    storage_slug = EXCLUDED.storage_slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    preview_ref = EXCLUDED.preview_ref,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

INSERT INTO catalog.cosmetic_set_items(set_id, cosmetic_id, position)
VALUES
  ('set.exercito', 'dice.attack.exercito', 0),
  ('set.exercito', 'dice.defense.exercito', 1),
  ('set.exercito', 'dice.neutral.exercito', 2),
  ('set.lancas', 'dice.attack.lancas', 0),
  ('set.lancas', 'dice.defense.lancas', 1),
  ('set.lancas', 'dice.neutral.lancas', 2),
  ('set.viking', 'dice.attack.viking', 0),
  ('set.viking', 'dice.defense.viking', 1),
  ('set.viking', 'dice.neutral.viking', 2),
  ('set.gato', 'dice.attack.gato', 0),
  ('set.gato', 'dice.defense.gato', 1),
  ('set.gato', 'dice.neutral.gato', 2),
  ('set.cachorro', 'dice.attack.cachorro', 0),
  ('set.cachorro', 'dice.defense.cachorro', 1),
  ('set.cachorro', 'dice.neutral.cachorro', 2),
  ('set.futebol', 'dice.attack.futebol', 0),
  ('set.futebol', 'dice.defense.futebol', 1),
  ('set.futebol', 'dice.neutral.futebol', 2)
ON CONFLICT (set_id, cosmetic_id) DO UPDATE
SET position = EXCLUDED.position;

-- Dice references in catalog must now be stable R2 WebP object keys. Territory
-- effects are semantic and therefore excluded from this format constraint.
ALTER TABLE catalog.cosmetics
  DROP CONSTRAINT IF EXISTS cosmetics_dice_asset_ref_webp_check;
ALTER TABLE catalog.cosmetics
  ADD CONSTRAINT cosmetics_dice_asset_ref_webp_check
  CHECK (
    slot NOT IN ('dice_attack', 'dice_defense', 'dice_neutral')
    OR asset_ref ~ '^cosmetics/dice/[a-z0-9]+(?:-[a-z0-9]+)*/(attack|defense|neutral)\.webp$'
  );

COMMENT ON COLUMN catalog.cosmetic_sets.storage_slug IS
  'Stable physical folder slug below cosmetics/dice/ in the configured object storage.';
COMMENT ON COLUMN catalog.cosmetic_sets.sort_order IS
  'Database-controlled storefront ordering; the frontend must not hardcode theme order.';
COMMENT ON COLUMN catalog.cosmetics.asset_ref IS
  'Stable object key for remote assets. Dice runtime references are WebP keys, never presigned URLs.';
