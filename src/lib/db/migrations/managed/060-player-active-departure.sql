-- Persistent player departure state.
-- Active gameplay authorization uses left_at IS NULL while historical match
-- snapshots may keep the player row until the room lifecycle can safely remove it.
--
-- Up Migration

ALTER TABLE game.players
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

ALTER TABLE game.players
  DROP CONSTRAINT IF EXISTS players_left_at_after_joined_check;

ALTER TABLE game.players
  ADD CONSTRAINT players_left_at_after_joined_check
  CHECK (left_at IS NULL OR left_at >= joined_at);

CREATE INDEX IF NOT EXISTS players_active_user_idx
  ON game.players(user_id, room_id)
  WHERE user_id IS NOT NULL AND left_at IS NULL;

COMMENT ON COLUMN game.players.left_at IS
  'Timestamp of an explicit in-game departure. NULL means the seat is still active.';

-- Down Migration
-- Forward fixes are preferred because departure state can become historical match data.
