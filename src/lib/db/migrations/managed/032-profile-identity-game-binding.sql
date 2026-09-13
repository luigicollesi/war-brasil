-- War-Brasil public commander identity and authenticated game-seat binding.
-- Better Auth remains authoritative for login/session/provider data.

CREATE SCHEMA IF NOT EXISTS profile;

CREATE TABLE IF NOT EXISTS profile.commanders (
  user_id UUID PRIMARY KEY
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  handle VARCHAR(32),
  display_name VARCHAR(48),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (handle IS NULL OR btrim(handle) <> ''),
  CHECK (display_name IS NULL OR btrim(display_name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS commanders_handle_normalized_uq
  ON profile.commanders (lower(btrim(handle)))
  WHERE handle IS NOT NULL;

CREATE INDEX IF NOT EXISTS commanders_display_name_normalized_idx
  ON profile.commanders (lower(btrim(display_name)))
  WHERE display_name IS NOT NULL;

ALTER TABLE game.players
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS display_name_snapshot VARCHAR(48),
  ADD COLUMN IF NOT EXISTS handle_snapshot VARCHAR(32);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'players_user_id_fkey'
      AND conrelid = 'game.players'::regclass
  ) THEN
    ALTER TABLE game.players
      ADD CONSTRAINT players_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth."user"(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS players_room_user_uq
  ON game.players (room_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS players_user_room_idx
  ON game.players (user_id, room_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE game.rooms
  ADD COLUMN IF NOT EXISTS match_mode TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rooms_match_mode_check'
      AND conrelid = 'game.rooms'::regclass
  ) THEN
    ALTER TABLE game.rooms
      ADD CONSTRAINT rooms_match_mode_check
      CHECK (match_mode IN ('classic', 'custom'));
  END IF;
END
$$;

COMMENT ON TABLE profile.commanders IS
  'Public War-Brasil commander identity. Auth credentials remain in auth.*.';
COMMENT ON COLUMN game.players.user_id IS
  'Persistent account identity for a human seat; NULL is allowed for bots and legacy seats.';
COMMENT ON COLUMN game.players.display_name_snapshot IS
  'Historical public display-name snapshot; never used for authorization.';
COMMENT ON COLUMN game.players.handle_snapshot IS
  'Historical public handle snapshot; never used for authorization.';
