-- Remove commander biography from the Profile domain.
--
-- Biography is no longer rendered, editable, projected by the API, or stored.
-- Existing biography values are intentionally discarded with the column.
--
-- Up Migration

ALTER TABLE profile.commanders
  DROP CONSTRAINT IF EXISTS commanders_bio_not_blank_check;

ALTER TABLE profile.commanders
  DROP COLUMN IF EXISTS bio;

-- Down Migration
-- Reintroducing a removed user-content field requires an explicit future product
-- decision and migration. Existing biography values cannot be reconstructed.
