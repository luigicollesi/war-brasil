-- Runtime representation for one or more simultaneous winners.
-- winner_player_id remains as a compatibility pointer while this table is the
-- normalized source for plural results.
--
-- Up Migration

CREATE TABLE IF NOT EXISTS game.room_winners (
  room_id BIGINT NOT NULL
    REFERENCES game.rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL
    REFERENCES game.players(id) ON DELETE CASCADE,
  declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id)
);

CREATE INDEX IF NOT EXISTS room_winners_player_idx
  ON game.room_winners(player_id, room_id);

COMMENT ON TABLE game.room_winners IS
  'Current room result winners. Supports simultaneous winners while winner_player_id remains compatibility-only.';

-- Down Migration
-- Forward fixes are preferred because match history may already reference the result.
