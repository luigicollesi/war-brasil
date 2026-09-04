-- A fase 021 foi uma fundação transitória. As ofertas registradas nela não
-- possuem informação suficiente para reconstruir descritores genéricos
-- (símbolo/coringa) sem adivinhar a intenção original, então não preservamos
-- esse histórico de desenvolvimento ao migrar para o contrato definitivo.
DELETE FROM game_player_trade_offers;

DROP INDEX IF EXISTS game_player_trade_offers_one_active_idx;

ALTER TABLE game_player_trade_offers
  DROP CONSTRAINT IF EXISTS game_player_trade_offers_status_check;

ALTER TABLE game_player_trade_offers
  ALTER COLUMN target_player_id SET NOT NULL,
  ALTER COLUMN offered_card_id DROP NOT NULL;

ALTER TABLE game_player_trade_offers
  ADD COLUMN IF NOT EXISTS offered_kind TEXT NOT NULL
    CHECK (offered_kind IN ('territory', 'symbol', 'wild')),
  ADD COLUMN IF NOT EXISTS offered_territory_id SMALLINT
    CHECK (offered_territory_id BETWEEN 1 AND 42),
  ADD COLUMN IF NOT EXISTS offered_symbol TEXT
    CHECK (offered_symbol IN ('leaf', 'gold', 'water')),
  ADD COLUMN IF NOT EXISTS counter_offered_kind TEXT
    CHECK (counter_offered_kind IN ('territory', 'symbol', 'wild')),
  ADD COLUMN IF NOT EXISTS counter_offered_territory_id SMALLINT
    CHECK (counter_offered_territory_id BETWEEN 1 AND 42),
  ADD COLUMN IF NOT EXISTS counter_offered_symbol TEXT
    CHECK (counter_offered_symbol IN ('leaf', 'gold', 'water')),
  ADD COLUMN IF NOT EXISTS counter_requested_kind TEXT
    CHECK (counter_requested_kind IN ('territory', 'symbol', 'wild')),
  ADD COLUMN IF NOT EXISTS counter_requested_territory_id SMALLINT
    CHECK (counter_requested_territory_id BETWEEN 1 AND 42),
  ADD COLUMN IF NOT EXISTS counter_requested_symbol TEXT
    CHECK (counter_requested_symbol IN ('leaf', 'gold', 'water')),
  ADD COLUMN IF NOT EXISTS accepted_terms TEXT
    CHECK (accepted_terms IN ('original', 'counter')),
  ADD COLUMN IF NOT EXISTS proposer_selected_card_id BIGINT
    REFERENCES game_cards(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS responder_selected_card_id BIGINT
    REFERENCES game_cards(id) ON DELETE RESTRICT;

ALTER TABLE game_player_trade_offers
  ADD CONSTRAINT game_player_trade_offers_status_check
  CHECK (
    status IN (
      'open',
      'countered',
      'accepted_pending_selection',
      'accepted',
      'declined',
      'cancelled'
    )
  );

ALTER TABLE game_player_trade_offers
  ADD CONSTRAINT game_player_trade_offers_offered_descriptor_check
  CHECK (
    (offered_kind='territory' AND offered_territory_id IS NOT NULL AND offered_symbol IS NULL)
    OR (offered_kind='symbol' AND offered_territory_id IS NULL AND offered_symbol IS NOT NULL)
    OR (offered_kind='wild' AND offered_territory_id IS NULL AND offered_symbol IS NULL)
  );

ALTER TABLE game_player_trade_offers
  ADD CONSTRAINT game_player_trade_offers_counter_descriptor_check
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
  );

CREATE UNIQUE INDEX game_player_trade_offers_one_active_idx
  ON game_player_trade_offers(room_id)
  WHERE status IN ('open', 'countered', 'accepted_pending_selection');