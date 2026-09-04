-- Compatibilidade convergente para bancos de desenvolvimento que tenham
-- executado uma revisão anterior da 022. Não apaga negociações válidas.

-- O CHECK transitório da 021 dependia de counter_card_id e precisa sair antes
-- da remoção das colunas concretas antigas.
DO $$
DECLARE
  legacy_constraint TEXT;
BEGIN
  FOR legacy_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid='game_player_trade_offers'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%counter_card_id%'
  LOOP
    EXECUTE format(
      'ALTER TABLE game_player_trade_offers DROP CONSTRAINT %I',
      legacy_constraint
    );
  END LOOP;
END $$;

ALTER TABLE game_player_trade_offers
  DROP COLUMN IF EXISTS offered_card_id,
  DROP COLUMN IF EXISTS counter_card_id,
  DROP COLUMN IF EXISTS accepted_card_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid='game_player_trade_offers'::regclass
      AND conname='game_player_trade_offers_responder_check'
  ) THEN
    ALTER TABLE game_player_trade_offers
      ADD CONSTRAINT game_player_trade_offers_responder_check
      CHECK (responder_player_id IS NULL OR responder_player_id=target_player_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid='game_player_trade_offers'::regclass
      AND conname='game_player_trade_offers_state_check'
  ) THEN
    ALTER TABLE game_player_trade_offers
      ADD CONSTRAINT game_player_trade_offers_state_check
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
      );
  END IF;
END $$;
