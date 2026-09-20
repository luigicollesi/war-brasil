-- Allow profile backgrounds to reuse already managed collection background WebPs.
-- This keeps bytes canonical in R2 while profile appearance remains authoritative
-- about ownership/equipment.
--
-- Up Migration

ALTER TABLE catalog.profile_backgrounds
  DROP CONSTRAINT IF EXISTS profile_backgrounds_asset_ref_check,
  DROP CONSTRAINT IF EXISTS profile_backgrounds_preview_ref_check;

ALTER TABLE catalog.profile_backgrounds
  ADD CONSTRAINT profile_backgrounds_asset_ref_check
    CHECK (
      asset_ref ~ '^cosmetics/profile-backgrounds/[a-z0-9]+(?:[-_][a-z0-9]+)*\\.webp$'
      OR asset_ref ~ '^store/collections/[a-z0-9]+(?:-[a-z0-9]+)*/background\\.webp$'
    ),
  ADD CONSTRAINT profile_backgrounds_preview_ref_check
    CHECK (
      preview_ref IS NULL
      OR preview_ref ~ '^cosmetics/profile-backgrounds/[a-z0-9]+(?:[-_][a-z0-9]+)*\\.webp$'
      OR preview_ref ~ '^store/collections/[a-z0-9]+(?:-[a-z0-9]+)*/background\\.webp$'
    );

-- Bootstrap the default profile background with an existing dark war-themed asset.
UPDATE catalog.profile_backgrounds
   SET asset_ref='store/collections/viking/background.webp',
       preview_ref='store/collections/viking/background.webp',
       updated_at=NOW()
 WHERE id='profile.background.default';

-- Reuse the existing Céu Noturno collection background as a profile cosmetic.
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
VALUES(
  'profile.background.cosmic-night',
  'ceu-noturno',
  'Céu Noturno',
  'Background de perfil reutilizando a arte oficial da coleção Céu Noturno.',
  'common',
  'store/collections/ceu-noturno/background.webp',
  'store/collections/ceu-noturno/background.webp',
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
    is_active=TRUE,
    updated_at=NOW();

COMMENT ON COLUMN catalog.profile_backgrounds.asset_ref IS
  'R2 object key for a dedicated profile background or a reusable store collection background.webp.';

-- Down Migration
-- Forward fixes are preferred because equipped/owned profile backgrounds are durable.
