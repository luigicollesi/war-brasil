-- PROFILE V3 durable identity, privacy and cosmetic-title foundation.
-- Authentication/session data remains authoritative in auth.*.
-- Presence remains ephemeral outside PostgreSQL; only last_seen_at is durable here.

-- Up Migration

CREATE SCHEMA IF NOT EXISTS profile;
CREATE SCHEMA IF NOT EXISTS catalog;

ALTER TABLE profile.commanders
  ADD COLUMN IF NOT EXISTS bio VARCHAR(240),
  ADD COLUMN IF NOT EXISTS portrait_source VARCHAR(16),
  ADD COLUMN IF NOT EXISTS portrait_ref TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'commanders_bio_not_blank_check'
      AND conrelid = 'profile.commanders'::regclass
  ) THEN
    ALTER TABLE profile.commanders
      ADD CONSTRAINT commanders_bio_not_blank_check
      CHECK (bio IS NULL OR btrim(bio) <> '');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'commanders_portrait_source_check'
      AND conrelid = 'profile.commanders'::regclass
  ) THEN
    ALTER TABLE profile.commanders
      ADD CONSTRAINT commanders_portrait_source_check
      CHECK (
        portrait_source IS NULL
        OR portrait_source IN ('auth', 'upload', 'catalog')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'commanders_portrait_pair_check'
      AND conrelid = 'profile.commanders'::regclass
  ) THEN
    ALTER TABLE profile.commanders
      ADD CONSTRAINT commanders_portrait_pair_check
      CHECK (
        (portrait_source IS NULL AND portrait_ref IS NULL)
        OR (portrait_source IS NOT NULL AND portrait_ref IS NOT NULL AND btrim(portrait_ref) <> '')
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS profile.privacy_settings (
  user_id UUID PRIMARY KEY
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  presence_visibility VARCHAR(16) NOT NULL DEFAULT 'friends'
    CHECK (presence_visibility IN ('public', 'friends', 'private')),
  activity_visibility VARCHAR(16) NOT NULL DEFAULT 'friends'
    CHECK (activity_visibility IN ('public', 'friends', 'private')),
  history_visibility VARCHAR(16) NOT NULL DEFAULT 'friends'
    CHECK (history_visibility IN ('public', 'friends', 'private')),
  friend_request_policy VARCHAR(24) NOT NULL DEFAULT 'everyone'
    CHECK (friend_request_policy IN ('everyone', 'friends_of_friends', 'nobody')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog.commander_titles (
  id TEXT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  description TEXT,
  rarity VARCHAR(16) NOT NULL DEFAULT 'common'
    CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (btrim(id) <> ''),
  CHECK (btrim(name) <> ''),
  CHECK (description IS NULL OR btrim(description) <> '')
);

CREATE TABLE IF NOT EXISTS profile.commander_titles (
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL
    REFERENCES catalog.commander_titles(id) ON DELETE RESTRICT,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, title_id)
);

ALTER TABLE profile.commanders
  ADD COLUMN IF NOT EXISTS equipped_title_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'commanders_equipped_title_owned_fkey'
      AND conrelid = 'profile.commanders'::regclass
  ) THEN
    ALTER TABLE profile.commanders
      ADD CONSTRAINT commanders_equipped_title_owned_fkey
      FOREIGN KEY (user_id, equipped_title_id)
      REFERENCES profile.commander_titles(user_id, title_id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS commander_titles_title_user_idx
  ON profile.commander_titles (title_id, user_id);

COMMENT ON COLUMN profile.commanders.bio IS
  'Optional public commander biography. Privacy projection is enforced by the profile service.';
COMMENT ON COLUMN profile.commanders.portrait_source IS
  'Origin of the selected portrait reference: auth, upload or catalog.';
COMMENT ON COLUMN profile.commanders.portrait_ref IS
  'Reference only; image bytes are stored outside PostgreSQL.';
COMMENT ON COLUMN profile.commanders.last_seen_at IS
  'Durable last-known presence timestamp. Current online state is not stored in PostgreSQL.';
COMMENT ON COLUMN profile.commanders.equipped_title_id IS
  'Currently equipped cosmetic title; composite FK guarantees the commander owns it.';
COMMENT ON TABLE profile.privacy_settings IS
  'Server-enforced public/social visibility preferences for a commander.';
COMMENT ON TABLE profile.commander_titles IS
  'Cosmetic titles unlocked by each authenticated commander.';
COMMENT ON TABLE catalog.commander_titles IS
  'Catalog of cosmetic commander titles. Titles are not competitive rank or level.';
