-- Storefront collection promotions: one featured collection at a time with an
-- authoritative discount applied after the product's normal completion discount.

-- Up Migration

ALTER TABLE catalog.collections
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS promotion_discount_bps INTEGER NOT NULL DEFAULT 0;

ALTER TABLE catalog.collections
  DROP CONSTRAINT IF EXISTS collections_promotion_discount_check;
ALTER TABLE catalog.collections
  ADD CONSTRAINT collections_promotion_discount_check
  CHECK (promotion_discount_bps BETWEEN 0 AND 10000);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_collections_one_featured_uq
  ON catalog.collections(featured)
  WHERE featured;

ALTER TABLE economy.purchases
  ADD COLUMN IF NOT EXISTS promotion_discount_bps INTEGER NOT NULL DEFAULT 0;

ALTER TABLE economy.purchases
  DROP CONSTRAINT IF EXISTS economy_purchases_promotion_discount_check;
ALTER TABLE economy.purchases
  ADD CONSTRAINT economy_purchases_promotion_discount_check
  CHECK (promotion_discount_bps BETWEEN 0 AND 10000);

-- Promotions are editorial state, not permanent item pricing. Reset current
-- collection promotion state before selecting the launch feature.
UPDATE catalog.collections
   SET featured=FALSE,
       promotion_discount_bps=0,
       updated_at=NOW();

UPDATE catalog.collections
   SET featured=TRUE,
       promotion_discount_bps=4000,
       active=TRUE,
       updated_at=NOW()
 WHERE id='collection.football';

COMMENT ON COLUMN catalog.collections.featured IS
  'At most one active merchandising collection is selected for the storefront hero.';
COMMENT ON COLUMN catalog.collections.promotion_discount_bps IS
  'Temporary collection discount applied after the product/completion discount; 4000 means 40 percent.';
COMMENT ON COLUMN economy.purchases.promotion_discount_bps IS
  'Snapshot of the collection promotion discount applied to this receipt.';

-- Down Migration
-- Promotion state may be referenced by durable receipts. Prefer a forward fix.
