CREATE SCHEMA IF NOT EXISTS game;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS game.rooms (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(12) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'order_roll', 'playing', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  match_mode TEXT NOT NULL DEFAULT 'custom'
    CONSTRAINT rooms_match_mode_check
      CHECK (match_mode IN ('classic', 'custom')),
  ruleset TEXT NOT NULL DEFAULT 'objective'
    CONSTRAINT rooms_ruleset_check
      CHECK (ruleset IN ('objective', 'supremacy')),
  balanced_dice_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  order_roll_round INTEGER NOT NULL DEFAULT 1
    CHECK (order_roll_round >= 1),
  initial_territory_presentation_started_at TIMESTAMPTZ,
  phase VARCHAR(20) NOT NULL DEFAULT 'trade'
    CHECK (
      phase IN ('trade', 'reinforcement', 'attack', 'maneuver', 'end_turn', 'finished')
      OR (phase = 'cards' AND status = 'order_roll')
    ),
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
  trade_offers_used SMALLINT NOT NULL DEFAULT 0
    CHECK (trade_offers_used BETWEEN 0 AND 3),
  winner_player_id BIGINT,
  pending_from_territory_id SMALLINT CHECK (pending_from_territory_id BETWEEN 1 AND 42),
  pending_to_territory_id SMALLINT CHECK (pending_to_territory_id BETWEEN 1 AND 42),
  last_battle JSONB,
  automation_due_at TIMESTAMPTZ,
  automation_kind VARCHAR(20)
    CHECK (automation_kind IS NULL OR automation_kind IN ('presentation', 'bot')),
  automation_claimed_by TEXT,
  automation_claimed_until TIMESTAMPTZ,
  CHECK (
    (pending_from_territory_id IS NULL AND pending_to_territory_id IS NULL)
    OR (pending_from_territory_id IS NOT NULL AND pending_to_territory_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS rooms_automation_due_idx
  ON game.rooms (automation_due_at, id)
  WHERE automation_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS rooms_automation_claim_idx
  ON game.rooms (automation_due_at, automation_claimed_until, id)
  WHERE automation_due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS game.players (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES game.rooms(id) ON DELETE CASCADE,
  player_session UUID NOT NULL,
  faction_name VARCHAR(32) NOT NULL,
  color VARCHAR(16) NOT NULL
    CHECK (color IN ('forest', 'ocean', 'sun', 'ruby', 'violet', 'orange')),
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  card_trade_count INTEGER NOT NULL DEFAULT 0
    CHECK (card_trade_count >= 0),
  trade_signals_used SMALLINT NOT NULL DEFAULT 0
    CHECK (trade_signals_used BETWEEN 0 AND 2),
  bot_next_action_at TIMESTAMPTZ,
  turn_position SMALLINT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ
    CONSTRAINT players_left_at_after_joined_check
      CHECK (left_at IS NULL OR left_at >= joined_at),
  UNIQUE (room_id, color),
  UNIQUE (room_id, player_session),
  UNIQUE (room_id, turn_position)
);

CREATE INDEX IF NOT EXISTS players_room_id_idx ON game.players(room_id);

CREATE TABLE IF NOT EXISTS ops.command_receipts (
  room_id BIGINT NOT NULL REFERENCES game.rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES game.players(id) ON DELETE CASCADE,
  command_id UUID NOT NULL,
  command_name VARCHAR(80) NOT NULL,
  request_fingerprint CHAR(64) NOT NULL
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 1),
  base_revision INTEGER NOT NULL CHECK (base_revision >= 1),
  revision INTEGER NOT NULL CHECK (revision >= 2),
  response_value JSONB NOT NULL,
  response_patch JSONB,
  response_private_patch JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id, command_id),
  CHECK (expected_revision = base_revision),
  CHECK (revision > base_revision)
);

CREATE INDEX IF NOT EXISTS command_receipts_room_created_idx
  ON ops.command_receipts (room_id, created_at);

CREATE TABLE IF NOT EXISTS catalog.bot_names (
  id BIGSERIAL PRIMARY KEY,
  color VARCHAR(16) NOT NULL
    CHECK (color IN ('forest', 'ocean', 'sun', 'ruby', 'violet', 'orange')),
  name VARCHAR(32) NOT NULL,
  UNIQUE (color, name)
);

INSERT INTO catalog.bot_names (color, name) VALUES
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

CREATE TABLE IF NOT EXISTS catalog.territory_card_symbols (
  territory_id INTEGER PRIMARY KEY
    CHECK (territory_id BETWEEN 1 AND 42),
  symbol TEXT NOT NULL
    CHECK (symbol IN ('leaf', 'gold', 'water'))
);

CREATE TABLE IF NOT EXISTS catalog.territory_connections (
  territory_a INTEGER NOT NULL
    CHECK (territory_a BETWEEN 1 AND 42),
  territory_b INTEGER NOT NULL
    CHECK (territory_b BETWEEN 1 AND 42),
  is_passable BOOLEAN NOT NULL DEFAULT TRUE,
  barrier_name TEXT,
  description TEXT,
  PRIMARY KEY (territory_a, territory_b),
  CHECK (territory_a < territory_b)
);

ALTER TABLE game.rooms
  ADD CONSTRAINT rooms_current_player_fkey
  FOREIGN KEY (current_player_id) REFERENCES game.players(id) ON DELETE SET NULL;

ALTER TABLE game.rooms
  ADD CONSTRAINT rooms_winner_player_fkey
  FOREIGN KEY (winner_player_id) REFERENCES game.players(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS game.room_winners (
  room_id BIGINT NOT NULL REFERENCES game.rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES game.players(id) ON DELETE CASCADE,
  declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id)
);

CREATE INDEX IF NOT EXISTS room_winners_player_idx
  ON game.room_winners(player_id, room_id);

CREATE TABLE IF NOT EXISTS game.rematch_votes (
  room_id BIGINT NOT NULL REFERENCES game.rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES game.players(id) ON DELETE CASCADE,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id)
);

CREATE INDEX IF NOT EXISTS rematch_votes_room_id_idx
  ON game.rematch_votes(room_id);

CREATE TABLE IF NOT EXISTS game.territories (
  room_id BIGINT NOT NULL REFERENCES game.rooms(id) ON DELETE CASCADE,
  territory_id SMALLINT NOT NULL CHECK (territory_id BETWEEN 1 AND 42),
  owner_player_id BIGINT NOT NULL REFERENCES game.players(id) ON DELETE RESTRICT,
  troops SMALLINT NOT NULL DEFAULT 1 CHECK (troops >= 1),
  moved_in_turn SMALLINT NOT NULL DEFAULT 0 CHECK (moved_in_turn >= 0 AND moved_in_turn <= troops),
  initial_draw_order SMALLINT CHECK (initial_draw_order BETWEEN 1 AND 42),
  PRIMARY KEY (room_id, territory_id)
);

CREATE INDEX IF NOT EXISTS territories_room_owner_idx
  ON game.territories(room_id, owner_player_id);

CREATE UNIQUE INDEX IF NOT EXISTS territories_room_initial_draw_order_idx
  ON game.territories(room_id, initial_draw_order)
  WHERE initial_draw_order IS NOT NULL;

CREATE TABLE IF NOT EXISTS game.order_rolls (
  room_id BIGINT NOT NULL REFERENCES game.rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES game.players(id) ON DELETE CASCADE,
  roll_round INTEGER NOT NULL CHECK (roll_round >= 1),
  value SMALLINT NOT NULL CHECK (value BETWEEN 1 AND 6),
  rolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id, roll_round)
);

CREATE TABLE IF NOT EXISTS catalog.objectives (
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
  fallback_objective_id TEXT REFERENCES catalog.objectives(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog.objective_rules (
  id BIGSERIAL PRIMARY KEY,
  objective_id TEXT NOT NULL REFERENCES catalog.objectives(id) ON DELETE CASCADE,
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
  ON catalog.objective_rules(objective_id, player_count)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS objective_rules_player_count_idx
  ON catalog.objective_rules(player_count, is_active);

CREATE TABLE IF NOT EXISTS game.player_objectives (
  room_id BIGINT NOT NULL REFERENCES game.rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES game.players(id) ON DELETE CASCADE,
  objective_id TEXT NOT NULL REFERENCES catalog.objectives(id),
  objective_rule_id BIGINT REFERENCES catalog.objective_rules(id) ON DELETE RESTRICT,
  target_player_id BIGINT REFERENCES game.players(id) ON DELETE SET NULL,
  resolved_params JSONB
    CHECK (resolved_params IS NULL OR jsonb_typeof(resolved_params) = 'object'),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id)
);

CREATE INDEX IF NOT EXISTS player_objectives_target_idx
  ON game.player_objectives(room_id, target_player_id);

CREATE INDEX IF NOT EXISTS player_objectives_rule_idx
  ON game.player_objectives(objective_rule_id);

CREATE TABLE IF NOT EXISTS game.cards (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES game.rooms(id) ON DELETE CASCADE,
  territory_id SMALLINT CHECK (territory_id BETWEEN 1 AND 42),
  symbol TEXT CHECK (symbol IN ('leaf', 'gold', 'water')),
  is_wild BOOLEAN NOT NULL DEFAULT FALSE,
  owner_player_id BIGINT REFERENCES game.players(id) ON DELETE SET NULL,
  zone VARCHAR(12) NOT NULL DEFAULT 'deck'
    CHECK (zone IN ('deck', 'hand', 'discard')),
  deck_order INTEGER,
  CHECK ((is_wild AND territory_id IS NULL AND symbol IS NULL) OR
         (NOT is_wild AND territory_id IS NOT NULL AND symbol IS NOT NULL)),
  UNIQUE (room_id, territory_id)
);

CREATE INDEX IF NOT EXISTS cards_room_zone_idx
  ON game.cards(room_id, zone, deck_order);

CREATE INDEX IF NOT EXISTS cards_hand_idx
  ON game.cards(room_id, owner_player_id)
  WHERE zone='hand';

CREATE TABLE IF NOT EXISTS game.trade_offers (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES game.rooms(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL CHECK (turn_number >= 1),
  proposer_player_id BIGINT NOT NULL REFERENCES game.players(id) ON DELETE CASCADE,
  target_player_id BIGINT NOT NULL REFERENCES game.players(id) ON DELETE CASCADE,
  offered_kind TEXT NOT NULL
    CHECK (offered_kind IN ('territory', 'symbol', 'wild')),
  offered_territory_id SMALLINT CHECK (offered_territory_id BETWEEN 1 AND 42),
  offered_symbol TEXT CHECK (offered_symbol IN ('leaf', 'gold', 'water')),
  requested_kind TEXT NOT NULL
    CHECK (requested_kind IN ('territory', 'symbol', 'wild')),
  requested_territory_id SMALLINT CHECK (requested_territory_id BETWEEN 1 AND 42),
  requested_symbol TEXT CHECK (requested_symbol IN ('leaf', 'gold', 'water')),
  status TEXT NOT NULL DEFAULT 'open'
    CONSTRAINT trade_offers_status_check CHECK (status IN (
      'open',
      'countered',
      'accepted_pending_selection',
      'accepted',
      'declined',
      'cancelled'
    )),
  responder_player_id BIGINT REFERENCES game.players(id) ON DELETE SET NULL,
  counter_offered_kind TEXT CHECK (counter_offered_kind IN ('territory', 'symbol', 'wild')),
  counter_offered_territory_id SMALLINT CHECK (counter_offered_territory_id BETWEEN 1 AND 42),
  counter_offered_symbol TEXT CHECK (counter_offered_symbol IN ('leaf', 'gold', 'water')),
  counter_requested_kind TEXT CHECK (counter_requested_kind IN ('territory', 'symbol', 'wild')),
  counter_requested_territory_id SMALLINT CHECK (counter_requested_territory_id BETWEEN 1 AND 42),
  counter_requested_symbol TEXT CHECK (counter_requested_symbol IN ('leaf', 'gold', 'water')),
  accepted_terms TEXT CHECK (accepted_terms IN ('original', 'counter')),
  proposer_selected_card_id BIGINT REFERENCES game.cards(id) ON DELETE RESTRICT,
  responder_selected_card_id BIGINT REFERENCES game.cards(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT trade_offers_target_player_check
    CHECK (target_player_id IS NULL OR target_player_id <> proposer_player_id),
  CONSTRAINT trade_offers_responder_check
    CHECK (responder_player_id IS NULL OR responder_player_id=target_player_id),
  CONSTRAINT trade_offers_offered_descriptor_check
    CHECK (
      (offered_kind='territory' AND offered_territory_id IS NOT NULL AND offered_symbol IS NULL)
      OR (offered_kind='symbol' AND offered_territory_id IS NULL AND offered_symbol IS NOT NULL)
      OR (offered_kind='wild' AND offered_territory_id IS NULL AND offered_symbol IS NULL)
    ),
  CONSTRAINT trade_offers_requested_descriptor_check
    CHECK (
      (requested_kind='territory' AND requested_territory_id IS NOT NULL AND requested_symbol IS NULL)
      OR (requested_kind='symbol' AND requested_territory_id IS NULL AND requested_symbol IS NOT NULL)
      OR (requested_kind='wild' AND requested_territory_id IS NULL AND requested_symbol IS NULL)
    ),
  CONSTRAINT trade_offers_counter_descriptor_check
    CHECK (
      (counter_offered_kind IS NULL AND counter_offered_territory_id IS NULL AND counter_offered_symbol IS NULL
        AND counter_requested_kind IS NULL AND counter_requested_territory_id IS NULL AND counter_requested_symbol IS NULL)
      OR (
        (
          (counter_offered_kind='territory' AND counter_offered_territory_id IS NOT NULL AND counter_offered_symbol IS NULL)
          OR (counter_offered_kind='symbol' AND counter_offered_territory_id IS NULL AND counter_offered_symbol IS NOT NULL)
          OR (counter_offered_kind='wild' AND counter_offered_territory_id IS NULL AND counter_offered_symbol IS NULL)
        )
        AND (
          (counter_requested_kind='territory' AND counter_requested_territory_id IS NOT NULL AND counter_requested_symbol IS NULL)
          OR (counter_requested_kind='symbol' AND counter_requested_territory_id IS NULL AND counter_requested_symbol IS NOT NULL)
          OR (counter_requested_kind='wild' AND counter_requested_territory_id IS NULL AND counter_requested_symbol IS NULL)
        )
      )
    ),
  CONSTRAINT trade_offers_state_check
    CHECK (
      (
        status='open'
        AND responder_player_id IS NULL
        AND counter_offered_kind IS NULL
        AND counter_requested_kind IS NULL
        AND accepted_terms IS NULL
        AND proposer_selected_card_id IS NULL
        AND responder_selected_card_id IS NULL
        AND resolved_at IS NULL
      )
      OR (
        status='countered'
        AND responder_player_id IS NOT NULL
        AND counter_offered_kind IS NOT NULL
        AND counter_requested_kind IS NOT NULL
        AND accepted_terms IS NULL
        AND proposer_selected_card_id IS NULL
        AND responder_selected_card_id IS NULL
        AND resolved_at IS NULL
      )
      OR (
        status='accepted_pending_selection'
        AND responder_player_id IS NOT NULL
        AND accepted_terms IS NOT NULL
        AND (
          (accepted_terms='original' AND counter_offered_kind IS NULL AND counter_requested_kind IS NULL)
          OR (accepted_terms='counter' AND counter_offered_kind IS NOT NULL AND counter_requested_kind IS NOT NULL)
        )
        AND (proposer_selected_card_id IS NULL OR responder_selected_card_id IS NULL)
        AND resolved_at IS NULL
      )
      OR (
        status='accepted'
        AND responder_player_id IS NOT NULL
        AND accepted_terms IS NOT NULL
        AND (
          (accepted_terms='original' AND counter_offered_kind IS NULL AND counter_requested_kind IS NULL)
          OR (accepted_terms='counter' AND counter_offered_kind IS NOT NULL AND counter_requested_kind IS NOT NULL)
        )
        AND proposer_selected_card_id IS NOT NULL
        AND responder_selected_card_id IS NOT NULL
        AND resolved_at IS NOT NULL
      )
      OR (
        status IN ('declined','cancelled')
        AND accepted_terms IS NULL
        AND proposer_selected_card_id IS NULL
        AND responder_selected_card_id IS NULL
        AND resolved_at IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS trade_offers_one_active_idx
  ON game.trade_offers(room_id)
  WHERE status IN ('open', 'countered', 'accepted_pending_selection');

CREATE INDEX IF NOT EXISTS trade_offers_room_turn_idx
  ON game.trade_offers(room_id, turn_number, id DESC);

CREATE TABLE IF NOT EXISTS catalog.events (
  id INTEGER PRIMARY KEY CHECK (id >= 0),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  effects JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(effects) = 'array')
);

CREATE TABLE IF NOT EXISTS catalog.event_connections (
  from_event INTEGER NOT NULL REFERENCES catalog.events(id) ON DELETE CASCADE,
  to_event INTEGER NOT NULL REFERENCES catalog.events(id) ON DELETE CASCADE,
  weight INTEGER NOT NULL CHECK (weight > 0),
  PRIMARY KEY (from_event, to_event),
  CHECK (to_event <> 0),
  CHECK (from_event <> to_event)
);

CREATE TABLE IF NOT EXISTS game.round_events (
  room_id BIGINT NOT NULL REFERENCES game.rooms(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),
  event_id INTEGER NOT NULL REFERENCES catalog.events(id) ON DELETE RESTRICT,
  resolved_effects JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(resolved_effects) = 'array'),
  applied_troop_changes JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(applied_troop_changes) = 'array'),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, round_number)
);

CREATE INDEX IF NOT EXISTS round_events_event_id_idx
  ON game.round_events(event_id);

CREATE TABLE IF NOT EXISTS catalog.dice_balance_profiles (
  id TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL
    CONSTRAINT dice_balance_profiles_algorithm_check
      CHECK (algorithm IN ('uniform', 'adaptive_halves')),
  alpha DOUBLE PRECISION NOT NULL,
  pressure_cap DOUBLE PRECISION NOT NULL,
  dead_zone DOUBLE PRECISION NOT NULL,
  retention_per_round DOUBLE PRECISION NOT NULL,
  max_group_shift DOUBLE PRECISION NOT NULL,
  inner_tilt DOUBLE PRECISION NOT NULL,
  min_face_probability DOUBLE PRECISION NOT NULL,
  max_face_probability DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dice_balance_profiles_probability_range_check CHECK (
    min_face_probability > 0
    AND max_face_probability < 1
    AND min_face_probability <= max_face_probability
  ),
  CONSTRAINT dice_balance_profiles_algorithm_parameters_check CHECK (
    (
      algorithm = 'uniform'
      AND alpha = 0
      AND pressure_cap = 0
      AND dead_zone = 0
      AND retention_per_round = 1
      AND max_group_shift = 0
      AND inner_tilt = 0
    )
    OR
    (
      algorithm = 'adaptive_halves'
      AND alpha > 0 AND alpha <= 1
      AND pressure_cap > 0 AND pressure_cap <= 1
      AND dead_zone >= 0 AND dead_zone < pressure_cap
      AND retention_per_round > 0 AND retention_per_round <= 1
      AND max_group_shift > 0 AND max_group_shift < 0.5
      AND inner_tilt >= 0 AND inner_tilt < (1.0 / 3.0)
    )
  )
);

INSERT INTO catalog.dice_balance_profiles (
  id, algorithm, alpha, pressure_cap, dead_zone, retention_per_round,
  max_group_shift, inner_tilt, min_face_probability, max_face_probability
) VALUES
  (
    'uniform-v1', 'uniform', 0, 0, 0, 1,
    0, 0, (1.0 / 6.0), (1.0 / 6.0)
  ),
  (
    'adaptive-halves-v1', 'adaptive_halves', 0.12, 0.60, 0.10, 0.80,
    0.20, 0.03, 0.09, 0.27
  )
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS catalog.dice_balance_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1
    CONSTRAINT dice_balance_settings_singleton_check CHECK (id = 1),
  default_profile_id TEXT NOT NULL
    CONSTRAINT dice_balance_settings_default_profile_fkey
      REFERENCES catalog.dice_balance_profiles(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO catalog.dice_balance_settings (id, default_profile_id)
VALUES (1, 'adaptive-halves-v1')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION catalog.reject_dice_balance_profile_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'dice balance profiles are append-only; create a new profile version instead';
END;
$$;

DROP TRIGGER IF EXISTS dice_balance_profiles_append_only
  ON catalog.dice_balance_profiles;
CREATE TRIGGER dice_balance_profiles_append_only
BEFORE UPDATE OR DELETE ON catalog.dice_balance_profiles
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_dice_balance_profile_mutation();

CREATE TABLE IF NOT EXISTS game.matches (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL
    CONSTRAINT matches_room_id_fkey
      REFERENCES game.rooms(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL
    CONSTRAINT matches_sequence_check CHECK (sequence >= 1),
  requested_profile_id TEXT
    CONSTRAINT matches_requested_profile_fkey
      REFERENCES catalog.dice_balance_profiles(id) ON DELETE RESTRICT,
  resolved_profile_id TEXT NOT NULL,
  profile_source TEXT NOT NULL
    CONSTRAINT matches_profile_source_check
      CHECK (profile_source IN ('catalog', 'builtin_fallback')),
  dice_balance_profile_snapshot JSONB NOT NULL
    CONSTRAINT matches_profile_snapshot_object_check
      CHECK (jsonb_typeof(dice_balance_profile_snapshot) = 'object'),
  match_mode_snapshot TEXT
    CONSTRAINT matches_match_mode_snapshot_check
      CHECK (match_mode_snapshot IS NULL OR match_mode_snapshot IN ('classic', 'custom')),
  ruleset_snapshot TEXT
    CONSTRAINT matches_ruleset_snapshot_check
      CHECK (ruleset_snapshot IS NULL OR ruleset_snapshot IN ('objective', 'supremacy')),
  balanced_dice_enabled_snapshot BOOLEAN,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  CONSTRAINT matches_room_sequence_key UNIQUE (room_id, sequence),
  CONSTRAINT matches_room_id_id_key UNIQUE (room_id, id),
  CONSTRAINT matches_profile_resolution_check CHECK (
    (
      profile_source = 'catalog'
      AND requested_profile_id IS NOT NULL
      AND resolved_profile_id = requested_profile_id
    )
    OR
    (
      profile_source = 'builtin_fallback'
      AND resolved_profile_id = 'builtin-uniform-v1'
    )
  ),
  CONSTRAINT matches_finished_at_check
    CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE OR REPLACE FUNCTION game.reject_match_dice_profile_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'match dice profile fields are immutable after match creation';
END;
$$;

DROP TRIGGER IF EXISTS matches_dice_profile_immutable ON game.matches;
CREATE TRIGGER matches_dice_profile_immutable
BEFORE UPDATE OF requested_profile_id,resolved_profile_id,profile_source,dice_balance_profile_snapshot
ON game.matches
FOR EACH ROW
EXECUTE FUNCTION game.reject_match_dice_profile_mutation();

CREATE OR REPLACE FUNCTION game.reject_match_rule_snapshot_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'match rule snapshot fields are immutable after match creation';
END;
$$;

DROP TRIGGER IF EXISTS matches_rule_snapshot_immutable ON game.matches;
CREATE TRIGGER matches_rule_snapshot_immutable
BEFORE UPDATE OF match_mode_snapshot,ruleset_snapshot,balanced_dice_enabled_snapshot
ON game.matches
FOR EACH ROW
EXECUTE FUNCTION game.reject_match_rule_snapshot_mutation();

ALTER TABLE game.rooms
  ADD COLUMN IF NOT EXISTS current_match_id BIGINT;

ALTER TABLE game.rooms
  ADD CONSTRAINT rooms_current_match_fkey
  FOREIGN KEY (id, current_match_id)
  REFERENCES game.matches(room_id, id)
  ON DELETE SET NULL (current_match_id);

CREATE TABLE IF NOT EXISTS game.player_dice_states (
  match_id BIGINT NOT NULL
    CONSTRAINT player_dice_states_match_id_fkey
      REFERENCES game.matches(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL
    CONSTRAINT player_dice_states_player_id_fkey
      REFERENCES game.players(id) ON DELETE CASCADE,
  pressure DOUBLE PRECISION NOT NULL DEFAULT 0
    CONSTRAINT player_dice_states_pressure_check
      CHECK (pressure BETWEEN -1.0 AND 1.0),
  batch_count INTEGER NOT NULL DEFAULT 0
    CONSTRAINT player_dice_states_batch_count_check CHECK (batch_count >= 0),
  last_roll_round INTEGER
    CONSTRAINT player_dice_states_last_roll_round_check
      CHECK (last_roll_round IS NULL OR last_roll_round >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_dice_states_pkey PRIMARY KEY (match_id, player_id),
  CONSTRAINT player_dice_states_batch_history_check CHECK (
    (batch_count = 0 AND last_roll_round IS NULL)
    OR (batch_count > 0 AND last_roll_round IS NOT NULL)
  )
);

CREATE OR REPLACE VIEW public.game_rooms AS SELECT * FROM game.rooms;
CREATE OR REPLACE VIEW public.room_players AS SELECT * FROM game.players;
CREATE OR REPLACE VIEW public.game_territories AS SELECT * FROM game.territories;
CREATE OR REPLACE VIEW public.game_order_rolls AS SELECT * FROM game.order_rolls;
CREATE OR REPLACE VIEW public.game_rematch_votes AS SELECT * FROM game.rematch_votes;
CREATE OR REPLACE VIEW public.game_player_objectives AS SELECT * FROM game.player_objectives;
CREATE OR REPLACE VIEW public.game_cards AS SELECT * FROM game.cards;
CREATE OR REPLACE VIEW public.game_player_trade_offers AS SELECT * FROM game.trade_offers;
CREATE OR REPLACE VIEW public.game_round_events AS SELECT * FROM game.round_events;
CREATE OR REPLACE VIEW public.objectives AS SELECT * FROM catalog.objectives;
CREATE OR REPLACE VIEW public.objective_rules AS SELECT * FROM catalog.objective_rules;
CREATE OR REPLACE VIEW public.events AS SELECT * FROM catalog.events;
CREATE OR REPLACE VIEW public.event_connections AS SELECT * FROM catalog.event_connections;
CREATE OR REPLACE VIEW public.bot_names AS SELECT * FROM catalog.bot_names;
CREATE OR REPLACE VIEW public.territory_card_symbols AS SELECT * FROM catalog.territory_card_symbols;
CREATE OR REPLACE VIEW public.territory_connections AS SELECT * FROM catalog.territory_connections;
CREATE OR REPLACE VIEW public.game_command_receipts AS SELECT * FROM ops.command_receipts;


-- 072-battle-pass-catalog-hardening
-- Passe de Campanha V1: strict catalog activation validator.
-- Extends the 070 activation guard with the complete V1 reward matrix and
-- Economy V2 Elite offer requirements.
--
-- Up Migration

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  level_count INTEGER;
  level_one_xp BIGINT;
  invalid_threshold_count INTEGER;
  free_credit BIGINT;
  premium_credit BIGINT;
  invalid_credit_count INTEGER;
  missing_credit_count INTEGER;
  extra_credit_count INTEGER;
  free_cosmetic_count INTEGER;
  premium_cosmetic_count INTEGER;
  invalid_cosmetic_count INTEGER;
  free_level_100_titles INTEGER;
  premium_level_100_titles INTEGER;
  level_100_credit_count INTEGER;
  empty_level_mismatch_count INTEGER;
  elite_offer_count INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::int,
         MIN(required_total_xp) FILTER (WHERE level=1)
    INTO level_count,level_one_xp
    FROM catalog.battle_pass_levels
   WHERE season_id=NEW.id;

  IF level_count <> 100 THEN
    RAISE EXCEPTION 'active battle pass requires exactly 100 levels';
  END IF;

  IF level_one_xp <> 0 THEN
    RAISE EXCEPTION 'active battle pass level 1 must start at 0 XP';
  END IF;

  SELECT COUNT(*)::int
    INTO invalid_threshold_count
    FROM (
      SELECT level,
             required_total_xp,
             LAG(required_total_xp) OVER (ORDER BY level) AS previous_xp
        FROM catalog.battle_pass_levels
       WHERE season_id=NEW.id
    ) thresholds
   WHERE level > 1
     AND (previous_xp IS NULL OR required_total_xp <= previous_xp);

  IF invalid_threshold_count <> 0 THEN
    RAISE EXCEPTION 'active battle pass XP thresholds must increase strictly';
  END IF;

  SELECT
    COALESCE(SUM(credit_amount) FILTER (
      WHERE track='free' AND reward_kind='campaign_credit'
    ),0),
    COALESCE(SUM(credit_amount) FILTER (
      WHERE track='premium' AND reward_kind='campaign_credit'
    ),0),
    COUNT(*) FILTER (
      WHERE reward_kind='campaign_credit' AND credit_amount < 5
    ),
    COUNT(*) FILTER (
      WHERE level=100 AND track='free' AND reward_kind='commander_title'
    ),
    COUNT(*) FILTER (
      WHERE level=100 AND track='premium' AND reward_kind='commander_title'
    ),
    COUNT(*) FILTER (
      WHERE level=100 AND reward_kind='campaign_credit'
    )
  INTO
    free_credit,
    premium_credit,
    invalid_credit_count,
    free_level_100_titles,
    premium_level_100_titles,
    level_100_credit_count
  FROM catalog.battle_pass_rewards
  WHERE season_id=NEW.id;

  IF free_credit <> 1000 THEN
    RAISE EXCEPTION 'active battle pass free track must grant exactly 1000 campaign credits';
  END IF;
  IF premium_credit <> 2500 THEN
    RAISE EXCEPTION 'active battle pass premium track must grant exactly 2500 campaign credits';
  END IF;
  IF invalid_credit_count <> 0 THEN
    RAISE EXCEPTION 'active battle pass credit rewards must grant at least 5 campaign credits';
  END IF;
  IF free_level_100_titles <> 1 OR premium_level_100_titles <> 1 THEN
    RAISE EXCEPTION 'active battle pass requires one free and one premium title at level 100';
  END IF;
  IF level_100_credit_count <> 0 THEN
    RAISE EXCEPTION 'battle pass level 100 cannot grant campaign credits';
  END IF;

  WITH expected(track,level,amount) AS (
    VALUES
      ('free'::varchar,2::smallint,5::bigint),
      ('free',4,15),('free',7,30),('free',10,50),
      ('free',12,5),('free',14,15),('free',17,30),('free',20,50),
      ('free',22,5),('free',24,15),('free',27,30),('free',30,50),
      ('free',32,5),('free',34,15),('free',37,30),('free',40,50),
      ('free',42,5),('free',44,15),('free',47,30),('free',50,50),
      ('free',52,5),('free',54,15),('free',57,30),('free',60,50),
      ('free',62,5),('free',64,15),('free',67,30),('free',70,50),
      ('free',72,5),('free',74,15),('free',77,30),('free',80,50),
      ('free',82,5),('free',84,15),('free',87,30),('free',90,50),
      ('free',92,5),('free',94,15),('free',97,30),('free',99,50),

      ('premium',1,5),('premium',3,20),('premium',5,50),
      ('premium',8,75),('premium',10,100),
      ('premium',11,5),('premium',13,20),('premium',15,50),
      ('premium',18,75),('premium',20,100),
      ('premium',21,5),('premium',23,20),('premium',25,50),
      ('premium',28,75),('premium',30,100),
      ('premium',31,5),('premium',33,20),('premium',35,50),
      ('premium',38,75),('premium',40,100),
      ('premium',41,5),('premium',43,20),('premium',45,50),
      ('premium',48,75),('premium',50,100),
      ('premium',51,5),('premium',53,20),('premium',55,50),
      ('premium',58,75),('premium',60,100),
      ('premium',61,5),('premium',63,20),('premium',65,50),
      ('premium',68,75),('premium',70,100),
      ('premium',71,5),('premium',73,20),('premium',75,50),
      ('premium',78,75),('premium',80,100),
      ('premium',81,5),('premium',83,20),('premium',85,50),
      ('premium',88,75),('premium',90,100),
      ('premium',91,5),('premium',93,20),('premium',95,50),
      ('premium',98,75),('premium',99,100)
  ),
  actual AS (
    SELECT track,level,credit_amount AS amount
      FROM catalog.battle_pass_rewards
     WHERE season_id=NEW.id
       AND reward_kind='campaign_credit'
  )
  SELECT
    (SELECT COUNT(*) FROM expected e
      WHERE NOT EXISTS (
        SELECT 1 FROM actual a
         WHERE a.track=e.track AND a.level=e.level AND a.amount=e.amount
      )),
    (SELECT COUNT(*) FROM actual a
      WHERE NOT EXISTS (
        SELECT 1 FROM expected e
         WHERE e.track=a.track AND e.level=a.level AND e.amount=a.amount
      ))
  INTO missing_credit_count,extra_credit_count;

  IF missing_credit_count <> 0 OR extra_credit_count <> 0 THEN
    RAISE EXCEPTION 'active battle pass credit matrix does not match V1';
  END IF;

  SELECT
    COUNT(*) FILTER (
      WHERE track='free' AND reward_kind<>'campaign_credit'
    ),
    COUNT(*) FILTER (
      WHERE track='premium' AND reward_kind<>'campaign_credit'
    )
  INTO free_cosmetic_count,premium_cosmetic_count
  FROM catalog.battle_pass_rewards
  WHERE season_id=NEW.id;

  IF free_cosmetic_count <> 6 OR premium_cosmetic_count <> 10 THEN
    RAISE EXCEPTION 'active battle pass must contain exactly 16 V1 cosmetic rewards';
  END IF;

  WITH actual AS (
    SELECT reward.level,reward.track,reward.reward_kind,
           cosmetic.slot,
           reward.presentation_group_key
      FROM catalog.battle_pass_rewards reward
      LEFT JOIN catalog.cosmetics cosmetic ON cosmetic.id=reward.cosmetic_id
     WHERE reward.season_id=NEW.id
       AND reward.reward_kind<>'campaign_credit'
  ),
  expected(level,track,reward_kind,slot,presentation_group_key) AS (
    VALUES
      (15::smallint,'free'::varchar,'game_cosmetic'::varchar,'dice_attack'::varchar,NULL::text),
      (35,'free','game_cosmetic','dice_defense',NULL),
      (55,'free','game_cosmetic','dice_neutral',NULL),
      (75,'free','game_cosmetic','territory_skin',NULL),
      (90,'free','profile_background',NULL,NULL),
      (100,'free','commander_title',NULL,NULL),

      (1,'premium','game_cosmetic','dice_attack','premium-initial-set'),
      (1,'premium','game_cosmetic','dice_defense','premium-initial-set'),
      (1,'premium','game_cosmetic','dice_neutral','premium-initial-set'),
      (1,'premium','game_cosmetic','territory_skin','premium-initial-set'),

      (60,'premium','game_cosmetic','dice_attack',NULL),
      (70,'premium','game_cosmetic','dice_defense',NULL),
      (80,'premium','game_cosmetic','dice_neutral',NULL),
      (90,'premium','game_cosmetic','territory_skin',NULL),
      (95,'premium','profile_background',NULL,NULL),
      (100,'premium','commander_title',NULL,NULL)
  )
  SELECT COUNT(*)::int
    INTO invalid_cosmetic_count
    FROM expected e
   WHERE NOT EXISTS (
     SELECT 1
       FROM actual a
      WHERE a.level=e.level
        AND a.track=e.track
        AND a.reward_kind=e.reward_kind
        AND a.slot IS NOT DISTINCT FROM e.slot
        AND (
          e.presentation_group_key IS NULL
          OR a.presentation_group_key=e.presentation_group_key
        )
   );

  IF invalid_cosmetic_count <> 0 THEN
    RAISE EXCEPTION 'active battle pass cosmetic matrix does not match V1';
  END IF;

  WITH expected(level) AS (
    VALUES
      (6::smallint),(9),(16),(19),(26),(29),(36),(39),(46),(49),
      (56),(59),(66),(69),(76),(79),(86),(89),(96)
  ),
  actual AS (
    SELECT level
      FROM catalog.battle_pass_levels level
     WHERE level.season_id=NEW.id
       AND NOT EXISTS (
         SELECT 1
           FROM catalog.battle_pass_rewards reward
          WHERE reward.season_id=NEW.id
            AND reward.level=level.level
       )
  )
  SELECT
    (SELECT COUNT(*) FROM expected e
      WHERE NOT EXISTS (SELECT 1 FROM actual a WHERE a.level=e.level))
    +
    (SELECT COUNT(*) FROM actual a
      WHERE NOT EXISTS (SELECT 1 FROM expected e WHERE e.level=a.level))
  INTO empty_level_mismatch_count;

  IF empty_level_mismatch_count <> 0 THEN
    RAISE EXCEPTION 'active battle pass empty-level matrix does not match V1';
  END IF;

  SELECT COUNT(*)::int
    INTO elite_offer_count
    FROM catalog.product_entitlements entitlement
    JOIN catalog.products product
      ON product.id=entitlement.product_id
     AND product.active=TRUE
    JOIN catalog.offers offer
      ON offer.product_id=product.id
     AND offer.active=TRUE
     AND offer.status='available'
     AND offer.currency_code='campaign-credit'
    JOIN catalog.battle_pass_pricing pricing
      ON pricing.season_id=entitlement.battle_pass_season_id
     AND pricing.fixed_price=3000
   WHERE entitlement.entitlement_kind='battle_pass_access'
     AND entitlement.battle_pass_season_id=NEW.id
     AND (offer.starts_at IS NULL OR offer.starts_at <= NEW.starts_at)
     AND (offer.ends_at IS NULL OR offer.ends_at >= NEW.ends_at);

  IF elite_offer_count <> 1 THEN
    RAISE EXCEPTION 'active battle pass requires exactly one Elite offer covering the season at 3000 campaign credits';
  END IF;

  RETURN NEW;
END
$body$;

COMMENT ON FUNCTION catalog.validate_battle_pass_activation() IS
  'Rejects activation unless the complete Bellum Civile Battle Pass V1 catalog matrix is valid.';

-- Down Migration
-- Keep validation forward-only once seasonal catalog data exists.



-- 073-battle-pass-catalog-immutability
-- Passe de Campanha V1: freeze live/historical seasonal catalog and keep
-- XP policies append-only after the activation validator introduced in 072.
--
-- Up Migration

CREATE OR REPLACE FUNCTION catalog.reject_battle_pass_xp_profile_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  RAISE EXCEPTION
    'battle pass XP profiles are append-only; create a new profile version instead';
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_xp_profiles_append_only
  ON catalog.battle_pass_xp_profiles;
CREATE TRIGGER battle_pass_xp_profiles_append_only
BEFORE UPDATE OR DELETE ON catalog.battle_pass_xp_profiles
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_battle_pass_xp_profile_mutation();

CREATE OR REPLACE FUNCTION catalog.guard_battle_pass_season_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  IF OLD.status='active' AND NEW.status NOT IN ('active','ended') THEN
    RAISE EXCEPTION 'active battle pass can only remain active or become ended';
  END IF;

  IF OLD.status='ended' AND NEW.status NOT IN ('ended','archived') THEN
    RAISE EXCEPTION 'ended battle pass can only remain ended or become archived';
  END IF;

  IF OLD.status='archived' AND NEW.status <> 'archived' THEN
    RAISE EXCEPTION 'archived battle pass cannot be reopened';
  END IF;

  IF OLD.status IN ('active','ended','archived')
     AND ROW(
       OLD.slug,
       OLD.name,
       OLD.description,
       OLD.starts_at,
       OLD.ends_at,
       OLD.claim_ends_at,
       OLD.max_level,
       OLD.xp_profile_id,
       OLD.hero_asset_ref,
       OLD.logo_asset_ref
     ) IS DISTINCT FROM ROW(
       NEW.slug,
       NEW.name,
       NEW.description,
       NEW.starts_at,
       NEW.ends_at,
       NEW.claim_ends_at,
       NEW.max_level,
       NEW.xp_profile_id,
       NEW.hero_asset_ref,
       NEW.logo_asset_ref
     ) THEN
    RAISE EXCEPTION
      'active or historical battle pass catalog is immutable';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_seasons_mutation_guard
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_seasons_mutation_guard
BEFORE UPDATE ON catalog.battle_pass_seasons
FOR EACH ROW
EXECUTE FUNCTION catalog.guard_battle_pass_season_mutation();

CREATE OR REPLACE FUNCTION catalog.reject_locked_battle_pass_child_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  old_status VARCHAR(16);
  new_status VARCHAR(16);
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT status
      INTO old_status
      FROM catalog.battle_pass_seasons
     WHERE id=OLD.season_id;

    IF old_status IN ('active','ended','archived') THEN
      RAISE EXCEPTION
        'active or historical battle pass child catalog is immutable';
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT status
      INTO new_status
      FROM catalog.battle_pass_seasons
     WHERE id=NEW.season_id;

    IF new_status IN ('active','ended','archived') THEN
      RAISE EXCEPTION
        'active or historical battle pass child catalog is immutable';
    END IF;
  END IF;

  IF TG_OP='DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_levels_mutation_guard
  ON catalog.battle_pass_levels;
CREATE TRIGGER battle_pass_levels_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON catalog.battle_pass_levels
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_locked_battle_pass_child_mutation();

DROP TRIGGER IF EXISTS battle_pass_rewards_mutation_guard
  ON catalog.battle_pass_rewards;
CREATE TRIGGER battle_pass_rewards_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON catalog.battle_pass_rewards
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_locked_battle_pass_child_mutation();

DROP TRIGGER IF EXISTS battle_pass_pricing_mutation_guard
  ON catalog.battle_pass_pricing;
CREATE TRIGGER battle_pass_pricing_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON catalog.battle_pass_pricing
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_locked_battle_pass_child_mutation();

COMMENT ON FUNCTION catalog.reject_locked_battle_pass_child_mutation() IS
  'Prevents live or historical seasonal levels, rewards and pricing from drifting after activation.';

-- Down Migration
-- Live/historical Battle Pass catalog is intentionally forward-only.



-- 074-battle-pass-season-lifecycle
-- Passe de Campanha V1: authoritative season lifecycle rollover.
-- Expired active rows are moved to ended so claim windows can remain visible
-- without blocking the next season's unique active slot.
--
-- Up Migration

CREATE OR REPLACE FUNCTION catalog.reconcile_battle_pass_season_lifecycle()
RETURNS INTEGER
LANGUAGE plpgsql
AS $body$
DECLARE
  changed INTEGER;
BEGIN
  UPDATE catalog.battle_pass_seasons
     SET status='ended',
         updated_at=NOW()
   WHERE status='active'
     AND ends_at <= CURRENT_TIMESTAMP;

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END
$body$;

CREATE OR REPLACE FUNCTION catalog.rollover_expired_battle_pass_before_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  IF NEW.status='active' AND OLD.status IS DISTINCT FROM 'active' THEN
    PERFORM catalog.reconcile_battle_pass_season_lifecycle();
  END IF;
  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_seasons_00_expired_rollover
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_seasons_00_expired_rollover
BEFORE UPDATE OF status ON catalog.battle_pass_seasons
FOR EACH ROW
EXECUTE FUNCTION catalog.rollover_expired_battle_pass_before_activation();

COMMENT ON FUNCTION catalog.reconcile_battle_pass_season_lifecycle() IS
  'Moves time-expired active Battle Pass seasons to ended while preserving their claim window.';
COMMENT ON TRIGGER battle_pass_seasons_00_expired_rollover
  ON catalog.battle_pass_seasons IS
  'Runs before the activation validator so an expired season cannot block the next active season.';

-- Down Migration
-- Seasonal lifecycle state is durable; prefer forward migrations.



-- 075-battle-pass-elite-price-integrity
-- Passe de Campanha V1: Elite must remain an isolated, undiscounted
-- Economy V2 entitlement so the authoritative purchase quote is exactly 3000 CR.
--
-- Up Migration

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_elite_economy_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  valid_offer_count INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::int
    INTO valid_offer_count
    FROM catalog.product_entitlements entitlement
    JOIN catalog.products product
      ON product.id=entitlement.product_id
    JOIN catalog.offers offer
      ON offer.product_id=product.id
    JOIN catalog.battle_pass_pricing pricing
      ON pricing.season_id=entitlement.battle_pass_season_id
   WHERE entitlement.entitlement_kind='battle_pass_access'
     AND entitlement.battle_pass_season_id=NEW.id
     AND pricing.fixed_price=3000
     AND product.active=TRUE
     AND product.bundle_discount_bps=0
     AND product.collection_id IS NULL
     AND (
       SELECT COUNT(*)
         FROM catalog.product_entitlements sibling
        WHERE sibling.product_id=product.id
     )=1
     AND offer.active=TRUE
     AND offer.status='available'
     AND offer.currency_code='campaign-credit'
     AND (offer.starts_at IS NULL OR offer.starts_at <= NEW.starts_at)
     AND (offer.ends_at IS NULL OR offer.ends_at >= NEW.ends_at);

  IF valid_offer_count <> 1 THEN
    RAISE EXCEPTION
      'active battle pass Elite must have exactly one isolated undiscounted 3000-credit offer';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_seasons_elite_economy_guard
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_seasons_elite_economy_guard
BEFORE INSERT OR UPDATE OF status ON catalog.battle_pass_seasons
FOR EACH ROW
EXECUTE FUNCTION catalog.validate_battle_pass_elite_economy_activation();

COMMENT ON FUNCTION catalog.validate_battle_pass_elite_economy_activation() IS
  'Prevents bundle/collection discounts or mixed entitlements from changing the V1 Elite price from exactly 3000 campaign credits.';

-- Down Migration
-- Battle Pass commerce constraints are forward-only once a season can be sold.
