ALTER TABLE game_rooms
  DROP CONSTRAINT IF EXISTS game_rooms_status_check;

ALTER TABLE game_rooms
  ADD CONSTRAINT game_rooms_status_check
  CHECK (status IN ('waiting', 'order_roll', 'playing'));

ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS order_roll_round INTEGER NOT NULL DEFAULT 1
  CHECK (order_roll_round >= 1);

ALTER TABLE room_players
  ADD COLUMN IF NOT EXISTS turn_position SMALLINT;

CREATE UNIQUE INDEX IF NOT EXISTS room_players_room_turn_position_key
  ON room_players(room_id, turn_position)
  WHERE turn_position IS NOT NULL;

CREATE TABLE IF NOT EXISTS game_territories (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  territory_id SMALLINT NOT NULL CHECK (territory_id BETWEEN 1 AND 42),
  owner_player_id BIGINT NOT NULL REFERENCES room_players(id) ON DELETE RESTRICT,
  troops SMALLINT NOT NULL DEFAULT 1 CHECK (troops >= 1),
  PRIMARY KEY (room_id, territory_id)
);

CREATE INDEX IF NOT EXISTS game_territories_room_owner_idx
  ON game_territories(room_id, owner_player_id);

CREATE TABLE IF NOT EXISTS game_order_rolls (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  roll_round INTEGER NOT NULL CHECK (roll_round >= 1),
  value SMALLINT NOT NULL CHECK (value BETWEEN 1 AND 6),
  rolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id, roll_round)
);
