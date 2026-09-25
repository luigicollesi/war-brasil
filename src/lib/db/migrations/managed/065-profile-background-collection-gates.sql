-- Collection-gated profile backgrounds.
-- Every source-managed non-default profile background belongs to its thematic
-- collection. Collection membership gates purchase eligibility, but the
-- individual background product/offer remains commercially independent.
--
-- Up Migration

-- Céu Noturno predates catalog.collections in the profile-background flow.
-- Register the stable collection identity now; it will only surface in the
-- gameplay collection storefront once gameplay cosmetics are assigned to it.
INSERT INTO catalog.collections(
  id, slug, name, description, active, sort_order
)
VALUES (
  'collection.ceu-noturno',
  'ceu-noturno',
  'Céu Noturno',
  'Coleção temática Céu Noturno.',
  TRUE,
  40
)
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    active=TRUE,
    sort_order=EXCLUDED.sort_order,
    updated_at=NOW();

UPDATE catalog.profile_backgrounds background
   SET collection_id=CASE background.id
         WHEN 'profile.background.cosmic-night' THEN 'collection.ceu-noturno'
         WHEN 'profile.background.viking' THEN 'collection.viking'
         WHEN 'profile.background.cat' THEN 'collection.cat'
         WHEN 'profile.background.dog' THEN 'collection.dog'
         WHEN 'profile.background.football' THEN 'collection.football'
         ELSE background.collection_id
       END,
       updated_at=NOW()
 WHERE background.id IN (
   'profile.background.cosmic-night',
   'profile.background.viking',
   'profile.background.cat',
   'profile.background.dog',
   'profile.background.football'
 );

-- The universal default is never collection-gated.
UPDATE catalog.profile_backgrounds
   SET collection_id=NULL,
       updated_at=NOW()
 WHERE id='profile.background.default';

-- Keep individual background commerce independent from collection promotion and
-- lifecycle. collection_id on the background itself is the unlock prerequisite;
-- products.collection_id remains reserved for explicit collection products.
UPDATE catalog.products product
   SET collection_id=NULL,
       updated_at=NOW()
 WHERE product.id IN (
   SELECT 'product.single.' || background.id
     FROM catalog.profile_backgrounds background
    WHERE background.is_default=FALSE
 );

COMMENT ON COLUMN catalog.profile_backgrounds.collection_id IS
  'Thematic collection membership. Non-default collection backgrounds require ownership of all announced/available gameplay cosmetics in this collection before purchase.';

-- Down Migration
-- Collection membership and purchases are durable user-facing catalogue state.
-- Revert through a forward migration instead of clearing these associations.
