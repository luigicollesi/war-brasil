-- Allow profile backgrounds and commander titles to belong to editorial collections
-- without coupling their individual offers to the collection's active lifecycle.
--
-- Up Migration

ALTER TABLE catalog.profile_backgrounds
  ADD COLUMN IF NOT EXISTS collection_id TEXT;

ALTER TABLE catalog.commander_titles
  ADD COLUMN IF NOT EXISTS collection_id TEXT;

ALTER TABLE catalog.profile_backgrounds
  DROP CONSTRAINT IF EXISTS profile_backgrounds_collection_fkey;
ALTER TABLE catalog.profile_backgrounds
  ADD CONSTRAINT profile_backgrounds_collection_fkey
  FOREIGN KEY (collection_id)
  REFERENCES catalog.collections(id)
  ON DELETE SET NULL;

ALTER TABLE catalog.commander_titles
  DROP CONSTRAINT IF EXISTS commander_titles_collection_fkey;
ALTER TABLE catalog.commander_titles
  ADD CONSTRAINT commander_titles_collection_fkey
  FOREIGN KEY (collection_id)
  REFERENCES catalog.collections(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profile_backgrounds_collection_idx
  ON catalog.profile_backgrounds(collection_id,is_active,id)
  WHERE collection_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS commander_titles_collection_idx
  ON catalog.commander_titles(collection_id,is_active,id)
  WHERE collection_id IS NOT NULL;

-- Existing collection backgrounds inherit the thematic collection they visually
-- represent. The default background intentionally remains outside collections.
UPDATE catalog.profile_backgrounds background
   SET collection_id=CASE background.id
         WHEN 'profile.background.viking' THEN 'collection.viking'
         WHEN 'profile.background.cat' THEN 'collection.cat'
         WHEN 'profile.background.dog' THEN 'collection.dog'
         WHEN 'profile.background.football' THEN 'collection.football'
         ELSE background.collection_id
       END,
       updated_at=NOW()
 WHERE background.id IN (
   'profile.background.viking',
   'profile.background.cat',
   'profile.background.dog',
   'profile.background.football'
 );

-- Individual profile-background products remain independent permanent products.
-- Collection membership is item metadata; only explicit collection bundles should
-- set products.collection_id and inherit collection availability/promotions.
UPDATE catalog.products product
   SET collection_id=NULL,
       updated_at=NOW()
 WHERE product.id IN (
   SELECT 'product.single.' || background.id
     FROM catalog.profile_backgrounds background
    WHERE background.is_default=FALSE
 );

COMMENT ON COLUMN catalog.profile_backgrounds.collection_id IS
  'Optional editorial collection membership. Does not by itself control individual-offer availability.';
COMMENT ON COLUMN catalog.commander_titles.collection_id IS
  'Optional editorial collection membership for commander titles. Paid title offers may remain disabled independently.';

-- Down Migration
-- Collection membership is durable catalogue metadata. Prefer a forward migration
-- to reassign or clear memberships instead of dropping these columns.
