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


-- Battle Pass clean-install alignment (managed migrations 070-071)
-- Source-of-truth behavior is mirrored from the managed migrations so a clean
-- schema and an upgraded database converge to the same final structure.

-- Passe de Campanha V1: seasonal progression foundation and match snapshots.
-- This migration intentionally does not activate/seed a season: XP thresholds,
-- seasonal cosmetic ids/assets and the first campaign window remain content decisions.
--
-- Up Migration

CREATE SCHEMA IF NOT EXISTS progression;

CREATE TABLE IF NOT EXISTS catalog.battle_pass_xp_profiles (
  id TEXT PRIMARY KEY,
  completion_xp INTEGER NOT NULL CHECK (completion_xp >= 0),
  victory_bonus_xp INTEGER NOT NULL CHECK (victory_bonus_xp >= 0),
  solo_human_bot_multiplier_bps INTEGER NOT NULL DEFAULT 10000
    CHECK (solo_human_bot_multiplier_bps BETWEEN 0 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (btrim(id) <> ''),
  CHECK (completion_xp + victory_bonus_xp > 0)
);

CREATE TABLE IF NOT EXISTS catalog.battle_pass_seasons (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name VARCHAR(96) NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  claim_ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','announced','active','ended','archived')),
  max_level SMALLINT NOT NULL DEFAULT 100 CHECK (max_level = 100),
  xp_profile_id TEXT NOT NULL
    REFERENCES catalog.battle_pass_xp_profiles(id) ON DELETE RESTRICT,
  hero_asset_ref TEXT,
  logo_asset_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (btrim(id) <> ''),
  CHECK (btrim(slug) <> ''),
  CHECK (btrim(name) <> ''),
  CHECK (description IS NULL OR btrim(description) <> ''),
  CHECK (ends_at > starts_at),
  CHECK (claim_ends_at >= ends_at),
  CHECK (hero_asset_ref IS NULL OR btrim(hero_asset_ref) <> ''),
  CHECK (logo_asset_ref IS NULL OR btrim(logo_asset_ref) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS battle_pass_seasons_single_active_uidx
  ON catalog.battle_pass_seasons ((status))
  WHERE status='active';

CREATE INDEX IF NOT EXISTS battle_pass_seasons_window_idx
  ON catalog.battle_pass_seasons(status,starts_at,ends_at);

CREATE TABLE IF NOT EXISTS catalog.battle_pass_levels (
  season_id TEXT NOT NULL
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 100),
  required_total_xp BIGINT NOT NULL CHECK (required_total_xp >= 0),
  PRIMARY KEY (season_id,level),
  UNIQUE (season_id,required_total_xp)
);

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_level_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM catalog.battle_pass_levels previous
     WHERE previous.season_id=NEW.season_id
       AND previous.level < NEW.level
       AND previous.required_total_xp >= NEW.required_total_xp
  ) THEN
    RAISE EXCEPTION 'battle pass XP thresholds must increase with level';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM catalog.battle_pass_levels following
     WHERE following.season_id=NEW.season_id
       AND following.level > NEW.level
       AND following.required_total_xp <= NEW.required_total_xp
  ) THEN
    RAISE EXCEPTION 'battle pass XP thresholds must increase with level';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_levels_threshold_guard
  ON catalog.battle_pass_levels;
CREATE TRIGGER battle_pass_levels_threshold_guard
BEFORE INSERT OR UPDATE OF level,required_total_xp,season_id
ON catalog.battle_pass_levels
FOR EACH ROW EXECUTE FUNCTION catalog.validate_battle_pass_level_threshold();

CREATE TABLE IF NOT EXISTS catalog.battle_pass_rewards (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  level SMALLINT NOT NULL,
  track VARCHAR(16) NOT NULL CHECK (track IN ('free','premium')),
  position SMALLINT NOT NULL DEFAULT 0 CHECK (position >= 0),
  reward_kind VARCHAR(32) NOT NULL
    CHECK (reward_kind IN (
      'campaign_credit',
      'game_cosmetic',
      'commander_title',
      'profile_background'
    )),
  credit_amount BIGINT,
  cosmetic_id TEXT REFERENCES catalog.cosmetics(id) ON DELETE RESTRICT,
  title_id TEXT REFERENCES catalog.commander_titles(id) ON DELETE RESTRICT,
  background_id TEXT REFERENCES catalog.profile_backgrounds(id) ON DELETE RESTRICT,
  presentation_group_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT battle_pass_rewards_level_fkey
    FOREIGN KEY (season_id,level)
    REFERENCES catalog.battle_pass_levels(season_id,level)
    ON DELETE CASCADE,
  CONSTRAINT battle_pass_rewards_position_key
    UNIQUE (season_id,level,track,position),
  CONSTRAINT battle_pass_rewards_id_season_key
    UNIQUE (id,season_id),
  CONSTRAINT battle_pass_rewards_payload_check CHECK (
    (
      reward_kind='campaign_credit'
      AND credit_amount >= 5
      AND cosmetic_id IS NULL
      AND title_id IS NULL
      AND background_id IS NULL
    )
    OR
    (
      reward_kind='game_cosmetic'
      AND credit_amount IS NULL
      AND cosmetic_id IS NOT NULL
      AND title_id IS NULL
      AND background_id IS NULL
    )
    OR
    (
      reward_kind='commander_title'
      AND credit_amount IS NULL
      AND cosmetic_id IS NULL
      AND title_id IS NOT NULL
      AND background_id IS NULL
    )
    OR
    (
      reward_kind='profile_background'
      AND credit_amount IS NULL
      AND cosmetic_id IS NULL
      AND title_id IS NULL
      AND background_id IS NOT NULL
    )
  ),
  CHECK (btrim(id) <> ''),
  CHECK (presentation_group_key IS NULL OR btrim(presentation_group_key) <> '')
);

CREATE INDEX IF NOT EXISTS battle_pass_rewards_season_track_level_idx
  ON catalog.battle_pass_rewards(season_id,track,level,position);

CREATE TABLE IF NOT EXISTS progression.battle_pass_progress (
  season_id TEXT NOT NULL
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  xp_total BIGINT NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
  level_reached SMALLINT NOT NULL DEFAULT 1 CHECK (level_reached BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season_id,user_id)
);

CREATE INDEX IF NOT EXISTS battle_pass_progress_user_updated_idx
  ON progression.battle_pass_progress(user_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS progression.battle_pass_xp_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season_id TEXT NOT NULL
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  source_type VARCHAR(24) NOT NULL
    CHECK (source_type IN ('match','admin_adjustment')),
  source_key TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (btrim(source_key) <> ''),
  UNIQUE (season_id,user_id,source_type,source_key)
);

CREATE INDEX IF NOT EXISTS battle_pass_xp_entries_user_created_idx
  ON progression.battle_pass_xp_entries(user_id,created_at DESC,id DESC);

CREATE TABLE IF NOT EXISTS progression.battle_pass_access (
  season_id TEXT NOT NULL
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  purchase_id UUID
    REFERENCES economy.purchases(id) ON DELETE RESTRICT,
  access_source VARCHAR(24) NOT NULL
    CHECK (access_source IN ('purchase','promotion','admin')),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season_id,user_id),
  CONSTRAINT battle_pass_access_purchase_shape_check CHECK (
    (access_source='purchase' AND purchase_id IS NOT NULL)
    OR (access_source<>'purchase' AND purchase_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS battle_pass_access_purchase_uidx
  ON progression.battle_pass_access(purchase_id)
  WHERE purchase_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS progression.battle_pass_reward_claims (
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id,reward_id),
  CONSTRAINT battle_pass_reward_claims_reward_fkey
    FOREIGN KEY (reward_id,season_id)
    REFERENCES catalog.battle_pass_rewards(id,season_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS battle_pass_reward_claims_user_season_idx
  ON progression.battle_pass_reward_claims(user_id,season_id,claimed_at DESC);

ALTER TABLE game.matches
  ADD COLUMN IF NOT EXISTS battle_pass_season_id TEXT,
  ADD COLUMN IF NOT EXISTS battle_pass_xp_profile_id TEXT,
  ADD COLUMN IF NOT EXISTS battle_pass_xp_profile_snapshot JSONB;

ALTER TABLE game.matches
  DROP CONSTRAINT IF EXISTS matches_battle_pass_season_fkey;
ALTER TABLE game.matches
  ADD CONSTRAINT matches_battle_pass_season_fkey
  FOREIGN KEY (battle_pass_season_id)
  REFERENCES catalog.battle_pass_seasons(id)
  ON DELETE RESTRICT;

ALTER TABLE game.matches
  DROP CONSTRAINT IF EXISTS matches_battle_pass_xp_profile_fkey;
ALTER TABLE game.matches
  ADD CONSTRAINT matches_battle_pass_xp_profile_fkey
  FOREIGN KEY (battle_pass_xp_profile_id)
  REFERENCES catalog.battle_pass_xp_profiles(id)
  ON DELETE RESTRICT;

ALTER TABLE game.matches
  DROP CONSTRAINT IF EXISTS matches_battle_pass_snapshot_shape_check;
ALTER TABLE game.matches
  ADD CONSTRAINT matches_battle_pass_snapshot_shape_check CHECK (
    (
      battle_pass_season_id IS NULL
      AND battle_pass_xp_profile_id IS NULL
      AND battle_pass_xp_profile_snapshot IS NULL
    )
    OR
    (
      battle_pass_season_id IS NOT NULL
      AND battle_pass_xp_profile_id IS NOT NULL
      AND battle_pass_xp_profile_snapshot IS NOT NULL
      AND jsonb_typeof(battle_pass_xp_profile_snapshot)='object'
    )
  );

CREATE OR REPLACE FUNCTION game.reject_match_battle_pass_snapshot_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  RAISE EXCEPTION 'match battle-pass snapshot fields are immutable after match creation';
END
$body$;

DROP TRIGGER IF EXISTS matches_battle_pass_snapshot_immutable
  ON game.matches;
CREATE TRIGGER matches_battle_pass_snapshot_immutable
BEFORE UPDATE OF battle_pass_season_id,battle_pass_xp_profile_id,battle_pass_xp_profile_snapshot
ON game.matches
FOR EACH ROW EXECUTE FUNCTION game.reject_match_battle_pass_snapshot_mutation();

ALTER TABLE game.match_participants
  ADD COLUMN IF NOT EXISTS left_at_snapshot TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  level_count INTEGER;
  free_credit BIGINT;
  premium_credit BIGINT;
  free_level_100_titles INTEGER;
  premium_level_100_titles INTEGER;
  level_100_credit_count INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::int
    INTO level_count
    FROM catalog.battle_pass_levels
   WHERE season_id=NEW.id;

  IF level_count <> 100 THEN
    RAISE EXCEPTION 'active battle pass requires exactly 100 levels';
  END IF;

  SELECT
    COALESCE(SUM(credit_amount) FILTER (
      WHERE track='free' AND reward_kind='campaign_credit'
    ),0),
    COALESCE(SUM(credit_amount) FILTER (
      WHERE track='premium' AND reward_kind='campaign_credit'
    ),0),
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
  IF free_level_100_titles <> 1 OR premium_level_100_titles <> 1 THEN
    RAISE EXCEPTION 'active battle pass requires one free and one premium title at level 100';
  END IF;
  IF level_100_credit_count <> 0 THEN
    RAISE EXCEPTION 'battle pass level 100 cannot grant campaign credits';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_seasons_activation_guard
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_seasons_activation_guard
BEFORE INSERT OR UPDATE OF status
ON catalog.battle_pass_seasons
FOR EACH ROW EXECUTE FUNCTION catalog.validate_battle_pass_activation();

COMMENT ON TABLE catalog.battle_pass_seasons IS
  'Versioned seasonal Battle Pass catalog. V1 seasons contain exactly 100 levels.';
COMMENT ON TABLE catalog.battle_pass_levels IS
  'Per-season cumulative XP thresholds. The active season is validated before activation.';
COMMENT ON TABLE catalog.battle_pass_rewards IS
  'Free/premium reward definitions. Reward ownership is granted only through progression claims.';
COMMENT ON TABLE progression.battle_pass_xp_entries IS
  'Append-only, idempotent XP grant ledger. Match grants are unique per user and match.';
COMMENT ON TABLE progression.battle_pass_progress IS
  'Materialized seasonal XP/level read model derived from XP grants.';
COMMENT ON TABLE progression.battle_pass_access IS
  'Per-season Elite access. Purchase access is tied to an Economy V2 purchase receipt.';
COMMENT ON TABLE progression.battle_pass_reward_claims IS
  'Durable proof that one Battle Pass reward was delivered to one user.';
COMMENT ON COLUMN game.matches.battle_pass_xp_profile_snapshot IS
  'Immutable XP-policy snapshot selected when the match starts. NULL means no active season.';

-- Down Migration
-- Progression/claim history is durable user-facing state. Prefer forward migrations.


-- Passe de Campanha V1: Economy V2 entitlement support for Elite access.
-- No concrete season/product/offer is seeded here; catalog content is activated
-- only after the first season rewards, XP curve and assets are defined.
--
-- Up Migration

ALTER TABLE catalog.product_entitlements
  ADD COLUMN IF NOT EXISTS battle_pass_season_id TEXT;

ALTER TABLE catalog.product_entitlements
  DROP CONSTRAINT IF EXISTS product_entitlements_entitlement_kind_check,
  DROP CONSTRAINT IF EXISTS product_entitlements_kind_check,
  DROP CONSTRAINT IF EXISTS product_entitlements_shape_check,
  DROP CONSTRAINT IF EXISTS product_entitlements_battle_pass_season_fkey;

ALTER TABLE catalog.product_entitlements
  ADD CONSTRAINT product_entitlements_kind_check
    CHECK (entitlement_kind IN (
      'game_cosmetic',
      'commander_title',
      'profile_background',
      'battle_pass_access'
    )),
  ADD CONSTRAINT product_entitlements_battle_pass_season_fkey
    FOREIGN KEY (battle_pass_season_id)
    REFERENCES catalog.battle_pass_seasons(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT product_entitlements_shape_check CHECK (
    (entitlement_kind='game_cosmetic'
      AND cosmetic_id IS NOT NULL AND title_id IS NULL
      AND background_id IS NULL AND battle_pass_season_id IS NULL)
    OR
    (entitlement_kind='commander_title'
      AND cosmetic_id IS NULL AND title_id IS NOT NULL
      AND background_id IS NULL AND battle_pass_season_id IS NULL)
    OR
    (entitlement_kind='profile_background'
      AND cosmetic_id IS NULL AND title_id IS NULL
      AND background_id IS NOT NULL AND battle_pass_season_id IS NULL)
    OR
    (entitlement_kind='battle_pass_access'
      AND cosmetic_id IS NULL AND title_id IS NULL
      AND background_id IS NULL AND battle_pass_season_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS product_entitlements_battle_pass_uidx
  ON catalog.product_entitlements(product_id,battle_pass_season_id)
  WHERE battle_pass_season_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalog.battle_pass_pricing (
  season_id TEXT PRIMARY KEY
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  fixed_price BIGINT NOT NULL CHECK (fixed_price = 3000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog.battle_pass_stats (
  season_id TEXT PRIMARY KEY
    REFERENCES catalog.battle_pass_seasons(id) ON DELETE CASCADE,
  acquisition_count BIGINT NOT NULL DEFAULT 0 CHECK (acquisition_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO catalog.battle_pass_stats(season_id,acquisition_count)
SELECT season.id,COUNT(access.user_id)::bigint
  FROM catalog.battle_pass_seasons season
  LEFT JOIN progression.battle_pass_access access
    ON access.season_id=season.id
 GROUP BY season.id
ON CONFLICT (season_id) DO NOTHING;

CREATE OR REPLACE FUNCTION catalog.ensure_battle_pass_stats_row()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  INSERT INTO catalog.battle_pass_stats(season_id,acquisition_count)
  VALUES(NEW.id,0)
  ON CONFLICT (season_id) DO NOTHING;
  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_stats_after_insert
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_stats_after_insert
AFTER INSERT ON catalog.battle_pass_seasons
FOR EACH ROW EXECUTE FUNCTION catalog.ensure_battle_pass_stats_row();

ALTER TABLE economy.purchase_entitlements
  ADD COLUMN IF NOT EXISTS battle_pass_season_id TEXT;

ALTER TABLE economy.purchase_entitlements
  DROP CONSTRAINT IF EXISTS purchase_entitlements_entitlement_kind_check,
  DROP CONSTRAINT IF EXISTS purchase_entitlements_kind_check,
  DROP CONSTRAINT IF EXISTS purchase_entitlements_shape_check,
  DROP CONSTRAINT IF EXISTS purchase_entitlements_battle_pass_season_fkey;

ALTER TABLE economy.purchase_entitlements
  ADD CONSTRAINT purchase_entitlements_kind_check
    CHECK (entitlement_kind IN (
      'game_cosmetic',
      'commander_title',
      'profile_background',
      'battle_pass_access'
    )),
  ADD CONSTRAINT purchase_entitlements_battle_pass_season_fkey
    FOREIGN KEY (battle_pass_season_id)
    REFERENCES catalog.battle_pass_seasons(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT purchase_entitlements_shape_check CHECK (
    (entitlement_kind='game_cosmetic'
      AND cosmetic_id IS NOT NULL AND title_id IS NULL
      AND background_id IS NULL AND battle_pass_season_id IS NULL)
    OR
    (entitlement_kind='commander_title'
      AND cosmetic_id IS NULL AND title_id IS NOT NULL
      AND background_id IS NULL AND battle_pass_season_id IS NULL)
    OR
    (entitlement_kind='profile_background'
      AND cosmetic_id IS NULL AND title_id IS NULL
      AND background_id IS NOT NULL AND battle_pass_season_id IS NULL)
    OR
    (entitlement_kind='battle_pass_access'
      AND cosmetic_id IS NULL AND title_id IS NULL
      AND background_id IS NULL AND battle_pass_season_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS purchase_entitlements_battle_pass_idx
  ON economy.purchase_entitlements(battle_pass_season_id,purchase_id)
  WHERE battle_pass_season_id IS NOT NULL;

COMMENT ON TABLE catalog.battle_pass_pricing IS
  'Fixed V1 Elite price. Every purchasable Battle Pass season costs exactly 3000 campaign credits.';
COMMENT ON TABLE catalog.battle_pass_stats IS
  'Global acquisition counter for Battle Pass Elite access through Economy V2.';
COMMENT ON COLUMN catalog.product_entitlements.battle_pass_season_id IS
  'Season granted when entitlement_kind=battle_pass_access.';
COMMENT ON COLUMN economy.purchase_entitlements.battle_pass_season_id IS
  'Immutable purchased Battle Pass season snapshot.';

-- Down Migration
-- Purchase/access history is durable; prefer forward migrations.

