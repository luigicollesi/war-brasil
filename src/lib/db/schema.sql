CREATE TABLE IF NOT EXISTS game_rooms (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(12) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'order_roll', 'playing', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  order_roll_round INTEGER NOT NULL DEFAULT 1
    CHECK (order_roll_round >= 1),
  phase VARCHAR(20) NOT NULL DEFAULT 'cards'
    CHECK (phase IN ('cards', 'reinforcement', 'attack', 'maneuver', 'end_turn', 'finished')),
  current_player_id BIGINT,
  turn_number INTEGER NOT NULL DEFAULT 1 CHECK (turn_number >= 1),
  round_number INTEGER NOT NULL DEFAULT 1 CHECK (round_number >= 1),
  jurassic_tunnel_territory_id SMALLINT
    CHECK (
      jurassic_tunnel_territory_id IS NULL
      OR (
        jurassic_tunnel_territory_id BETWEEN 1 AND 42
        AND jurassic_tunnel_territory_id NOT IN (1, 3)
      )
    ),
  reinforcements_remaining INTEGER NOT NULL DEFAULT 0 CHECK (reinforcements_remaining >= 0),
  conquered_this_turn BOOLEAN NOT NULL DEFAULT FALSE,
  trade_count INTEGER NOT NULL DEFAULT 0 CHECK (trade_count >= 0),
  winner_player_id BIGINT,
  pending_from_territory_id SMALLINT CHECK (pending_from_territory_id BETWEEN 1 AND 42),
  pending_to_territory_id SMALLINT CHECK (pending_to_territory_id BETWEEN 1 AND 42),
  last_battle JSONB,
  CHECK (
    (pending_from_territory_id IS NULL AND pending_to_territory_id IS NULL)
    OR (pending_from_territory_id IS NOT NULL AND pending_to_territory_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS room_players (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_session UUID NOT NULL,
  faction_name VARCHAR(32) NOT NULL,
  color VARCHAR(16) NOT NULL
    CHECK (color IN ('forest', 'ocean', 'sun', 'ruby', 'violet', 'orange')),
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  turn_position SMALLINT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, color),
  UNIQUE (room_id, player_session),
  UNIQUE (room_id, turn_position)
);

CREATE INDEX IF NOT EXISTS room_players_room_id_idx ON room_players(room_id);

ALTER TABLE game_rooms
  ADD CONSTRAINT game_rooms_current_player_fkey
  FOREIGN KEY (current_player_id) REFERENCES room_players(id) ON DELETE SET NULL;

ALTER TABLE game_rooms
  ADD CONSTRAINT game_rooms_winner_player_fkey
  FOREIGN KEY (winner_player_id) REFERENCES room_players(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS game_territories (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  territory_id SMALLINT NOT NULL CHECK (territory_id BETWEEN 1 AND 42),
  owner_player_id BIGINT NOT NULL REFERENCES room_players(id) ON DELETE RESTRICT,
  troops SMALLINT NOT NULL DEFAULT 1 CHECK (troops >= 1),
  moved_in_turn SMALLINT NOT NULL DEFAULT 0 CHECK (moved_in_turn >= 0 AND moved_in_turn <= troops),
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

CREATE TABLE IF NOT EXISTS game_player_objectives (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  objective_id TEXT NOT NULL REFERENCES objectives(id),
  target_player_id BIGINT REFERENCES room_players(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id)
);

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

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY CHECK (id >= 0),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  effects JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(effects) = 'array')
);

CREATE TABLE IF NOT EXISTS event_connections (
  from_event INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  to_event INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  weight INTEGER NOT NULL CHECK (weight > 0),
  PRIMARY KEY (from_event, to_event),
  CHECK (to_event <> 0),
  CHECK (from_event <> to_event)
);

CREATE TABLE IF NOT EXISTS game_round_events (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  resolved_effects JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(resolved_effects) = 'array'),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, round_number)
);

CREATE INDEX IF NOT EXISTS game_round_events_event_id_idx
  ON game_round_events(event_id);