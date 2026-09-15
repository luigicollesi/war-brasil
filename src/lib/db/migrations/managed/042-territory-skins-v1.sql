-- Territory Skins V1: constrain territory_effect to procedural XOR image modes
-- and seed the first four image skins. 042 intentionally avoids colliding with
-- Economy V2's parallel 041 migration.

-- Up Migration

ALTER TABLE catalog.cosmetics
  DROP CONSTRAINT IF EXISTS cosmetics_territory_effect_mode_check;
ALTER TABLE catalog.cosmetics
  ADD CONSTRAINT cosmetics_territory_effect_mode_check
  CHECK (
    slot <> 'territory_effect'
    OR (
      (effect_key IS NOT NULL AND asset_ref IS NULL)
      OR (
        effect_key IS NULL
        AND asset_ref IS NOT NULL
        AND asset_ref ~ '^cosmetics/territory-skins/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$'
      )
    )
  );

ALTER TABLE game.player_cosmetic_loadouts
  DROP CONSTRAINT IF EXISTS player_cosmetic_loadouts_territory_effect_mode_check;
ALTER TABLE game.player_cosmetic_loadouts
  ADD CONSTRAINT player_cosmetic_loadouts_territory_effect_mode_check
  CHECK (
    slot <> 'territory_effect'
    OR (
      (effect_key IS NOT NULL AND asset_ref IS NULL)
      OR (
        effect_key IS NULL
        AND asset_ref IS NOT NULL
        AND asset_ref ~ '^cosmetics/territory-skins/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$'
      )
    )
  );

INSERT INTO catalog.cosmetics(
  id,
  slug,
  name,
  description,
  slot,
  rarity,
  asset_ref,
  preview_ref,
  effect_key,
  status,
  is_default
)
VALUES
  (
    'territory.effect.azulejo-brasil',
    'azulejo-brasil',
    'Azulejo Brasil',
    'Acabamento territorial inspirado em azulejaria brasileira.',
    'territory_effect',
    NULL,
    'cosmetics/territory-skins/azulejo_brasil.webp',
    NULL,
    NULL,
    'announced',
    FALSE
  ),
  (
    'territory.effect.azulejo-ornamental',
    'azulejo-ornamental',
    'Azulejo Ornamental',
    'Acabamento territorial de azulejaria ornamental.',
    'territory_effect',
    NULL,
    'cosmetics/territory-skins/azulejo_ornamental.webp',
    NULL,
    NULL,
    'announced',
    FALSE
  ),
  (
    'territory.effect.ceu-estrelado',
    'ceu-estrelado',
    'Céu Estrelado',
    'Acabamento territorial com textura de céu estrelado.',
    'territory_effect',
    NULL,
    'cosmetics/territory-skins/ceu_estrelado.webp',
    NULL,
    NULL,
    'announced',
    FALSE
  ),
  (
    'territory.effect.solar-ornamental',
    'solar-ornamental',
    'Solar Ornamental',
    'Acabamento territorial ornamental de inspiração solar.',
    'territory_effect',
    NULL,
    'cosmetics/territory-skins/solar_ornamental.webp',
    NULL,
    NULL,
    'announced',
    FALSE
  )
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

COMMENT ON CONSTRAINT cosmetics_territory_effect_mode_check ON catalog.cosmetics IS
  'territory_effect is exactly one of procedural(effect_key) or image(asset_ref WebP object key).';
COMMENT ON CONSTRAINT player_cosmetic_loadouts_territory_effect_mode_check ON game.player_cosmetic_loadouts IS
  'Frozen territory skin snapshot preserves the same procedural/image XOR contract as catalog.';
