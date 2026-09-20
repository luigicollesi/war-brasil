-- Profile appearance foundation: rich commander titles and profile backgrounds.
-- Profile appearance entitlements are economic/social cosmetics and intentionally
-- remain separate from gameplay inventory and frozen match snapshot storage.
--
-- Up Migration

CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS profile;

-- ---------------------------------------------------------------------------
-- Rich commander-title presentation metadata.
-- ---------------------------------------------------------------------------

ALTER TABLE catalog.commander_titles
  ADD COLUMN IF NOT EXISTS display_text VARCHAR(96),
  ADD COLUMN IF NOT EXISTS font_key VARCHAR(48) NOT NULL DEFAULT 'command-display',
  ADD COLUMN IF NOT EXISTS style_key VARCHAR(48) NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS texture_ref TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE catalog.commander_titles
   SET display_text=name
 WHERE display_text IS NULL;

ALTER TABLE catalog.commander_titles
  ALTER COLUMN display_text SET NOT NULL;


CREATE OR REPLACE FUNCTION catalog.default_commander_title_display_text()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $
BEGIN
  IF NEW.display_text IS NULL OR btrim(NEW.display_text)='' THEN
    NEW.display_text := NEW.name;
  END IF;
  RETURN NEW;
END
$;

DROP TRIGGER IF EXISTS commander_title_display_text_default
  ON catalog.commander_titles;
CREATE TRIGGER commander_title_display_text_default
BEFORE INSERT OR UPDATE OF name,display_text ON catalog.commander_titles
FOR EACH ROW EXECUTE FUNCTION catalog.default_commander_title_display_text();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='commander_titles_display_text_not_blank_check'
       AND conrelid='catalog.commander_titles'::regclass
  ) THEN
    ALTER TABLE catalog.commander_titles
      ADD CONSTRAINT commander_titles_display_text_not_blank_check
      CHECK (btrim(display_text) <> '');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='commander_titles_font_key_check'
       AND conrelid='catalog.commander_titles'::regclass
  ) THEN
    ALTER TABLE catalog.commander_titles
      ADD CONSTRAINT commander_titles_font_key_check
      CHECK (font_key ~ '^[a-z0-9]+(?:[-_][a-z0-9]+)*$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='commander_titles_style_key_check'
       AND conrelid='catalog.commander_titles'::regclass
  ) THEN
    ALTER TABLE catalog.commander_titles
      ADD CONSTRAINT commander_titles_style_key_check
      CHECK (style_key ~ '^[a-z0-9]+(?:[-_][a-z0-9]+)*$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='commander_titles_texture_ref_check'
       AND conrelid='catalog.commander_titles'::regclass
  ) THEN
    ALTER TABLE catalog.commander_titles
      ADD CONSTRAINT commander_titles_texture_ref_check
      CHECK (
        texture_ref IS NULL
        OR texture_ref ~ '^cosmetics/title-textures/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$'
      );
  END IF;
END
$$;

ALTER TABLE profile.commander_titles
  ADD COLUMN IF NOT EXISTS acquisition_source VARCHAR(24) NOT NULL DEFAULT 'admin';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='commander_titles_acquisition_source_check'
       AND conrelid='profile.commander_titles'::regclass
  ) THEN
    ALTER TABLE profile.commander_titles
      ADD CONSTRAINT commander_titles_acquisition_source_check
      CHECK (acquisition_source IN ('default','purchase','reward','promotion','admin'));
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Profile background catalogue and ownership.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS catalog.profile_backgrounds (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name VARCHAR(96) NOT NULL,
  description TEXT,
  rarity VARCHAR(16) NOT NULL DEFAULT 'common',
  asset_ref TEXT NOT NULL,
  preview_ref TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profile_backgrounds_rarity_check
    CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  CONSTRAINT profile_backgrounds_asset_ref_check
    CHECK (asset_ref ~ '^cosmetics/profile-backgrounds/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$'),
  CONSTRAINT profile_backgrounds_preview_ref_check
    CHECK (
      preview_ref IS NULL
      OR preview_ref ~ '^cosmetics/profile-backgrounds/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$'
    ),
  CHECK (btrim(id) <> ''),
  CHECK (btrim(slug) <> ''),
  CHECK (btrim(name) <> ''),
  CHECK (description IS NULL OR btrim(description) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_backgrounds_single_default_uidx
  ON catalog.profile_backgrounds ((is_default))
  WHERE is_default=TRUE;

CREATE TABLE IF NOT EXISTS profile.commander_backgrounds (
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  background_id TEXT NOT NULL
    REFERENCES catalog.profile_backgrounds(id) ON DELETE RESTRICT,
  acquisition_source VARCHAR(24) NOT NULL DEFAULT 'default',
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, background_id),
  CONSTRAINT commander_backgrounds_acquisition_source_check
    CHECK (acquisition_source IN ('default','purchase','reward','promotion','admin'))
);

CREATE INDEX IF NOT EXISTS commander_backgrounds_background_user_idx
  ON profile.commander_backgrounds(background_id,user_id);

INSERT INTO catalog.profile_backgrounds(
  id,slug,name,description,rarity,asset_ref,preview_ref,is_default,is_active
)
VALUES(
  'profile.background.default',
  'default',
  'Comando Padrão',
  'Background padrão concedido a todo comandante.',
  'common',
  'cosmetics/profile-backgrounds/default.webp',
  'cosmetics/profile-backgrounds/default.webp',
  TRUE,
  TRUE
)
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    rarity=EXCLUDED.rarity,
    asset_ref=EXCLUDED.asset_ref,
    preview_ref=EXCLUDED.preview_ref,
    is_default=TRUE,
    is_active=TRUE,
    updated_at=NOW();

-- Every existing commander owns the default background.
INSERT INTO profile.commander_backgrounds(
  user_id,background_id,acquisition_source
)
SELECT commander.user_id,'profile.background.default','default'
  FROM profile.commanders commander
ON CONFLICT (user_id,background_id) DO NOTHING;

ALTER TABLE profile.commanders
  ADD COLUMN IF NOT EXISTS equipped_background_id TEXT;

CREATE OR REPLACE FUNCTION profile.ensure_commander_default_background()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $
DECLARE
  default_background_id TEXT;
BEGIN
  IF NEW.equipped_background_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id
    INTO default_background_id
    FROM catalog.profile_backgrounds
   WHERE is_default=TRUE
     AND is_active=TRUE
   ORDER BY id
   LIMIT 1;

  IF default_background_id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_BACKGROUND_DEFAULT_MISSING';
  END IF;

  INSERT INTO profile.commander_backgrounds(
    user_id,background_id,acquisition_source
  )
  VALUES(NEW.user_id,default_background_id,'default')
  ON CONFLICT (user_id,background_id) DO NOTHING;

  NEW.equipped_background_id := default_background_id;
  RETURN NEW;
END
$;

DROP TRIGGER IF EXISTS commander_default_background_before_insert
  ON profile.commanders;
CREATE TRIGGER commander_default_background_before_insert
BEFORE INSERT ON profile.commanders
FOR EACH ROW EXECUTE FUNCTION profile.ensure_commander_default_background();

UPDATE profile.commanders
   SET equipped_background_id='profile.background.default'
 WHERE equipped_background_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='commanders_equipped_background_owned_fkey'
       AND conrelid='profile.commanders'::regclass
  ) THEN
    ALTER TABLE profile.commanders
      ADD CONSTRAINT commanders_equipped_background_owned_fkey
      FOREIGN KEY (user_id,equipped_background_id)
      REFERENCES profile.commander_backgrounds(user_id,background_id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END
$$;

ALTER TABLE profile.commanders
  ALTER COLUMN equipped_background_id SET NOT NULL;

COMMENT ON COLUMN catalog.commander_titles.display_text IS
  'Exact public title text rendered on commander profiles.';
COMMENT ON COLUMN catalog.commander_titles.font_key IS
  'Allow-listed frontend font token. It is data, never executable CSS.';
COMMENT ON COLUMN catalog.commander_titles.style_key IS
  'Allow-listed frontend visual-style token supporting colors/gradients/textures.';
COMMENT ON COLUMN catalog.commander_titles.texture_ref IS
  'Optional R2 WebP object key used only by allow-listed title styles.';
COMMENT ON TABLE catalog.profile_backgrounds IS
  'Economic catalogue of public-profile background cosmetics. Not gameplay inventory.';
COMMENT ON TABLE profile.commander_backgrounds IS
  'Profile-background entitlements owned by each commander.';
COMMENT ON COLUMN profile.commanders.equipped_background_id IS
  'Mandatory equipped public-profile background; composite FK guarantees ownership.';

-- Down Migration
-- Forward fixes are preferred after rollout because profile appearance ownership
-- can acquire durable user-facing and commercial meaning.
