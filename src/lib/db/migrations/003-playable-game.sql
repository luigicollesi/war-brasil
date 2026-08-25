ALTER TABLE game_rooms
  DROP CONSTRAINT IF EXISTS game_rooms_status_check;

ALTER TABLE game_rooms
  ADD CONSTRAINT game_rooms_status_check
  CHECK (status IN ('waiting', 'order_roll', 'playing', 'finished'));

ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS phase VARCHAR(20) NOT NULL DEFAULT 'cards'
    CHECK (phase IN ('cards', 'reinforcement', 'attack', 'maneuver', 'end_turn', 'finished')),
  ADD COLUMN IF NOT EXISTS current_player_id BIGINT REFERENCES room_players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS turn_number INTEGER NOT NULL DEFAULT 1 CHECK (turn_number >= 1),
  ADD COLUMN IF NOT EXISTS reinforcements_remaining INTEGER NOT NULL DEFAULT 0 CHECK (reinforcements_remaining >= 0),
  ADD COLUMN IF NOT EXISTS conquered_this_turn BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trade_count INTEGER NOT NULL DEFAULT 0 CHECK (trade_count >= 0),
  ADD COLUMN IF NOT EXISTS winner_player_id BIGINT REFERENCES room_players(id) ON DELETE SET NULL;

ALTER TABLE game_territories
  ADD COLUMN IF NOT EXISTS moved_in_turn SMALLINT NOT NULL DEFAULT 0
    CHECK (moved_in_turn >= 0 AND moved_in_turn <= troops);

CREATE TABLE IF NOT EXISTS game_player_objectives (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  objective_id TEXT NOT NULL REFERENCES objectives(id),
  target_player_id BIGINT REFERENCES room_players(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id)
);

CREATE INDEX IF NOT EXISTS game_player_objectives_target_idx
  ON game_player_objectives(room_id, target_player_id);

CREATE TABLE IF NOT EXISTS game_cards (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  territory_id SMALLINT CHECK (territory_id BETWEEN 1 AND 42),
  symbol TEXT CHECK (symbol IN ('leaf', 'gold', 'water')),
  is_wild BOOLEAN NOT NULL DEFAULT FALSE,
  owner_player_id BIGINT REFERENCES room_players(id) ON DELETE SET NULL,
  zone VARCHAR(12) NOT NULL DEFAULT 'deck'
    CHECK (zone IN ('deck', 'hand', 'discard')),
  deck_order INTEGER,
  CHECK ((is_wild AND territory_id IS NULL AND symbol IS NULL) OR
         (NOT is_wild AND territory_id IS NOT NULL AND symbol IS NOT NULL)),
  UNIQUE (room_id, territory_id)
);

CREATE INDEX IF NOT EXISTS game_cards_room_zone_idx
  ON game_cards(room_id, zone, deck_order);

CREATE INDEX IF NOT EXISTS game_cards_hand_idx
  ON game_cards(room_id, owner_player_id)
  WHERE zone = 'hand';
