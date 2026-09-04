ALTER TABLE game_rooms
  DROP CONSTRAINT IF EXISTS game_rooms_phase_check;

UPDATE game_rooms
SET phase='trade'
WHERE phase='cards';

ALTER TABLE game_rooms
  ALTER COLUMN phase SET DEFAULT 'trade';

ALTER TABLE game_rooms
  ADD CONSTRAINT game_rooms_phase_check
  CHECK (phase IN ('trade', 'reinforcement', 'attack', 'maneuver', 'end_turn', 'finished'));

ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS trade_offers_used SMALLINT NOT NULL DEFAULT 0
    CHECK (trade_offers_used BETWEEN 0 AND 3);

ALTER TABLE room_players
  ADD COLUMN IF NOT EXISTS trade_signals_used SMALLINT NOT NULL DEFAULT 0
    CHECK (trade_signals_used BETWEEN 0 AND 2);

CREATE TABLE IF NOT EXISTS game_player_trade_offers (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL CHECK (turn_number >= 1),
  proposer_player_id BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  target_player_id BIGINT REFERENCES room_players(id) ON DELETE CASCADE,
  offered_card_id BIGINT NOT NULL REFERENCES game_cards(id) ON DELETE RESTRICT,
  requested_kind TEXT NOT NULL
    CHECK (requested_kind IN ('territory', 'symbol', 'wild')),
  requested_territory_id SMALLINT CHECK (requested_territory_id BETWEEN 1 AND 42),
  requested_symbol TEXT CHECK (requested_symbol IN ('leaf', 'gold', 'water')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'countered', 'accepted', 'declined', 'cancelled')),
  responder_player_id BIGINT REFERENCES room_players(id) ON DELETE SET NULL,
  counter_card_id BIGINT REFERENCES game_cards(id) ON DELETE RESTRICT,
  accepted_card_id BIGINT REFERENCES game_cards(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CHECK (target_player_id IS NULL OR target_player_id <> proposer_player_id),
  CHECK (
    (requested_kind='territory' AND requested_territory_id IS NOT NULL AND requested_symbol IS NULL)
    OR (requested_kind='symbol' AND requested_territory_id IS NULL AND requested_symbol IS NOT NULL)
    OR (requested_kind='wild' AND requested_territory_id IS NULL AND requested_symbol IS NULL)
  ),
  CHECK (
    status <> 'countered'
    OR (responder_player_id IS NOT NULL AND counter_card_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS game_player_trade_offers_one_active_idx
  ON game_player_trade_offers(room_id)
  WHERE status IN ('open', 'countered');

CREATE INDEX IF NOT EXISTS game_player_trade_offers_room_turn_idx
  ON game_player_trade_offers(room_id, turn_number, id DESC);
