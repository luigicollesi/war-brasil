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
  initial_territory_presentation_started_at TIMESTAMPTZ,
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
  automation_due_at TIMESTAMPTZ,
  automation_kind VARCHAR(20)
    CHECK (automation_kind IS NULL OR automation_kind IN ('presentation', 'bot')),
  CHECK (
    (pending_from_territory_id IS NULL AND pending_to_territory_id IS NULL)
    OR (pending_from_territory_id IS NOT NULL AND pending_to_territory_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS game_rooms_automation_due_idx
  ON game_rooms (automation_due_at, id)
  WHERE automation_due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS room_players (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_session UUID NOT NULL,
  faction_name VARCHAR(32) NOT NULL,
  color VARCHAR(16) NOT NULL
    CHECK (color IN ('forest', 'ocean', 'sun', 'ruby', 'violet', 'orange')),
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  card_trade_count INTEGER NOT NULL DEFAULT 0
    CHECK (card_trade_count >= 0),
  bot_next_action_at TIMESTAMPTZ,
  turn_position SMALLINT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, color),
  UNIQUE (room_id, player_session),
  UNIQUE (room_id, turn_position)
);

CREATE INDEX IF NOT EXISTS room_players_room_id_idx ON room_players(room_id);

CREATE TABLE IF NOT EXISTS game_command_receipts (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  command_id UUID NOT NULL,
  command_name VARCHAR(80) NOT NULL,
  request_fingerprint CHAR(64) NOT NULL
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 1),
  base_revision INTEGER NOT NULL CHECK (base_revision >= 1),
  revision INTEGER NOT NULL CHECK (revision >= 2),
  response_value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id, command_id),
  CHECK (expected_revision = base_revision),
  CHECK (revision > base_revision)
);

CREATE INDEX IF NOT EXISTS game_command_receipts_room_created_idx
  ON game_command_receipts (room_id, created_at);

CREATE TABLE IF NOT EXISTS bot_names (
  id BIGSERIAL PRIMARY KEY,
  color VARCHAR(16) NOT NULL
    CHECK (color IN ('forest', 'ocean', 'sun', 'ruby', 'violet', 'orange')),
  name VARCHAR(32) NOT NULL,
  UNIQUE (color, name)
);

INSERT INTO bot_names (color, name) VALUES
  ('forest', 'Integralistas'),
  ('forest', 'Cabanos'),
  ('forest', 'Conselheiristas'),
  ('forest', 'Federalistas'),
  ('ocean', 'Luzias'),
  ('ocean', 'Praieiros'),
  ('ocean', 'Exaltados'),
  ('ocean', 'Armada'),
  ('sun', 'Emboabas'),
  ('sun', 'Mascates'),
  ('sun', 'Balaios'),
  ('sun', 'Constitucionalistas'),
  ('ruby', 'Maragatos'),
  ('ruby', 'Farroupilhas'),
  ('ruby', 'Malês'),
  ('ruby', 'Tenentistas'),
  ('violet', 'Saquaremas'),
  ('violet', 'Caramurus'),
  ('violet', 'Restauradores'),
  ('violet', 'Áulicos'),
  ('orange', 'Chimangos'),
  ('orange', 'Pica-Paus'),
  ('orange', 'Sabinistas'),
  ('orange', 'Castilhistas')
ON CONFLICT (color, name) DO NOTHING;

ALTER TABLE game_rooms
  ADD CONSTRAINT game_rooms_current_player_fkey
  FOREIGN KEY (current_player_id) REFERENCES room_players(id) ON DELETE SET NULL;

ALTER TABLE game_rooms
  ADD CONSTRAINT game_rooms_winner_player_fkey
  FOREIGN KEY (winner_player_id) REFERENCES room_players(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS game_rematch_votes (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id)
);

CREATE INDEX IF NOT EXISTS game_rematch_votes_room_id_idx
  ON game_rematch_votes(room_id);

CREATE TABLE IF NOT EXISTS game_territories (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  territory_id SMALLINT NOT NULL CHECK (territory_id BETWEEN 1 AND 42),
  owner_player_id BIGINT NOT NULL REFERENCES room_players(id) ON DELETE RESTRICT,
  troops SMALLINT NOT NULL DEFAULT 1 CHECK (troops >= 1),
  moved_in_turn SMALLINT NOT NULL DEFAULT 0 CHECK (moved_in_turn >= 0 AND moved_in_turn <= troops),
  initial_draw_order SMALLINT CHECK (initial_draw_order BETWEEN 1 AND 42),
  PRIMARY KEY (room_id, territory_id)
);

CREATE INDEX IF NOT EXISTS game_territories_room_owner_idx
  ON game_territories(room_id, owner_player_id);

CREATE UNIQUE INDEX IF NOT EXISTS game_territories_room_initial_draw_order_idx
  ON game_territories(room_id, initial_draw_order)
  WHERE initial_draw_order IS NOT NULL;

CREATE TABLE IF NOT EXISTS game_order_rolls (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  roll_round INTEGER NOT NULL CHECK (roll_round >= 1),
  value SMALLINT NOT NULL CHECK (value BETWEEN 1 AND 6),
  rolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id, roll_round)
);

CREATE TABLE IF NOT EXISTS objectives (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (
    type IN (
      'regions',
      'region_plus',
      'territories',
      'fortification',
      'presence',
      'network',
      'elimination',
      'elimination_plus'
    )
  ),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (
    difficulty IN ('easy', 'medium', 'hard', 'very_hard')
  ),
  params JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(params) = 'object'),
  target_selector TEXT CHECK (
    target_selector IS NULL OR target_selector = 'random_other_player'
  ),
  fallback_objective_id TEXT REFERENCES objectives(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS objective_rules (
  id BIGSERIAL PRIMARY KEY,
  objective_id TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  player_count SMALLINT NOT NULL CHECK (player_count BETWEEN 2 AND 6),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  params JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(params) = 'object'),
  difficulty TEXT NOT NULL CHECK (
    difficulty IN ('easy', 'medium', 'hard', 'very_hard')
  ),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (objective_id, player_count, revision)
);

CREATE UNIQUE INDEX IF NOT EXISTS objective_rules_active_objective_player_count_idx
  ON objective_rules(objective_id, player_count)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS objective_rules_player_count_idx
  ON objective_rules(player_count, is_active);

CREATE TABLE IF NOT EXISTS game_player_objectives (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  objective_id TEXT NOT NULL REFERENCES objectives(id),
  objective_rule_id BIGINT REFERENCES objective_rules(id) ON DELETE RESTRICT,
  target_player_id BIGINT REFERENCES room_players(id) ON DELETE SET NULL,
  resolved_params JSONB
    CHECK (resolved_params IS NULL OR jsonb_typeof(resolved_params) = 'object'),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id)
);

CREATE INDEX IF NOT EXISTS game_player_objectives_target_idx
  ON game_player_objectives(room_id, target_player_id);

CREATE INDEX IF NOT EXISTS game_player_objectives_rule_idx
  ON game_player_objectives(objective_rule_id);

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
  applied_troop_changes JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(applied_troop_changes) = 'array'),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, round_number)
);

CREATE INDEX IF NOT EXISTS game_round_events_event_id_idx
  ON game_round_events(event_id);
