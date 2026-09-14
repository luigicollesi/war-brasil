-- Up Migration

-- Profile identity is intentionally text-only. These columns and constraints
-- were introduced by 034 before the product rule was finalized. Keep the
-- migration history forward-only and converge existing databases here.
ALTER TABLE profile.commanders
  DROP CONSTRAINT IF EXISTS commanders_portrait_pair_check,
  DROP CONSTRAINT IF EXISTS commanders_portrait_source_check;

ALTER TABLE profile.commanders
  DROP COLUMN IF EXISTS portrait_ref,
  DROP COLUMN IF EXISTS portrait_source;
