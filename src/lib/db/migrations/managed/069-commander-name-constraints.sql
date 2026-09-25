-- Harden commander identity shape at the persistence boundary.
--
-- Application code remains authoritative for harmful/reserved-name policy.
-- These NOT VALID checks protect future writes without blocking rollout because
-- of legacy rows that may predate the stricter naming rules.
--
-- Up Migration

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'commanders_handle_shape_check'
       AND conrelid = 'profile.commanders'::regclass
  ) THEN
    ALTER TABLE profile.commanders
      ADD CONSTRAINT commanders_handle_shape_check
      CHECK (
        handle IS NULL
        OR (
          char_length(handle) BETWEEN 3 AND 32
          AND handle ~ '^[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]$'
          AND handle !~ '[._-]{2}'
        )
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'commanders_display_name_shape_check'
       AND conrelid = 'profile.commanders'::regclass
  ) THEN
    ALTER TABLE profile.commanders
      ADD CONSTRAINT commanders_display_name_shape_check
      CHECK (
        display_name IS NULL
        OR (
          char_length(display_name) BETWEEN 2 AND 48
          AND display_name = btrim(display_name)
          AND display_name !~ '[[:cntrl:]]'
        )
      )
      NOT VALID;
  END IF;
END
$$;

-- Down Migration
ALTER TABLE profile.commanders
  DROP CONSTRAINT IF EXISTS commanders_display_name_shape_check;

ALTER TABLE profile.commanders
  DROP CONSTRAINT IF EXISTS commanders_handle_shape_check;
