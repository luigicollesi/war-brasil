-- Correct profile-background asset mapping and register collection backgrounds.
--
-- Up Migration

UPDATE catalog.profile_backgrounds
   SET asset_ref='cosmetics/profile-backgrounds/default.webp',
       preview_ref='cosmetics/profile-backgrounds/default.webp',
       updated_at=NOW()
 WHERE id='profile.background.default';

INSERT INTO catalog.profile_backgrounds(
  id,
  slug,
  name,
  description,
  rarity,
  asset_ref,
  preview_ref,
  is_default,
  is_active
)
VALUES
(
  'profile.background.viking',
  'viking',
  'Viking',
  'Background de perfil da coleção Viking.',
  'common',
  'store/collections/viking/background.webp',
  'store/collections/viking/background.webp',
  FALSE,
  TRUE
),
(
  'profile.background.cat',
  'cat',
  'Gato',
  'Background de perfil da coleção Gato.',
  'common',
  'store/collections/cat/background.webp',
  'store/collections/cat/background.webp',
  FALSE,
  TRUE
),
(
  'profile.background.dog',
  'dog',
  'Cachorro',
  'Background de perfil da coleção Cachorro.',
  'common',
  'store/collections/dog/background.webp',
  'store/collections/dog/background.webp',
  FALSE,
  TRUE
),
(
  'profile.background.football',
  'football',
  'Futebol',
  'Background de perfil da coleção Futebol.',
  'common',
  'store/collections/football/background.webp',
  'store/collections/football/background.webp',
  FALSE,
  TRUE
)
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    rarity=EXCLUDED.rarity,
    asset_ref=EXCLUDED.asset_ref,
    preview_ref=EXCLUDED.preview_ref,
    is_default=FALSE,
    is_active=TRUE,
    updated_at=NOW();

COMMENT ON COLUMN catalog.profile_backgrounds.asset_ref IS
  'R2 object key for a dedicated profile background or a reusable store collection background WebP.';

-- Down Migration
-- Forward fixes are preferred because background catalogue entries may become
-- durable economic entitlements.
