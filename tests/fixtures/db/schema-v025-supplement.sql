-- Tabelas de referência que existem no banco de desenvolvimento v025, mas
-- historicamente não faziam parte de src/lib/db/schema.sql/migrations 002-025.
CREATE TABLE territory_card_symbols (
  territory_id INTEGER PRIMARY KEY
    CHECK (territory_id BETWEEN 1 AND 42),
  symbol TEXT NOT NULL
    CHECK (symbol IN ('leaf', 'gold', 'water'))
);

CREATE TABLE territory_connections (
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

-- Dados sentinela permitem provar que 026 move o catálogo em vez de recriá-lo.
INSERT INTO territory_card_symbols(territory_id, symbol)
VALUES (1, 'leaf');

INSERT INTO territory_connections(
  territory_a,
  territory_b,
  is_passable,
  barrier_name,
  description
) VALUES (1, 2, FALSE, 'fixture-barrier', 'fixture-connection');

-- A migration 021 criou este check antes de target_player_id se tornar NOT NULL.
-- O snapshot antigo simplificou a expressão, então restauramos a definição que
-- existe em um banco realmente atualizado pelo histórico 021 -> 025.
DO $$
DECLARE
  current_name TEXT;
BEGIN
  SELECT conname INTO current_name
  FROM pg_constraint
  WHERE conrelid='game_player_trade_offers'::regclass
    AND contype='c'
    AND pg_get_constraintdef(oid) LIKE '%target_player_id%'
    AND pg_get_constraintdef(oid) LIKE '%proposer_player_id%'
    AND pg_get_constraintdef(oid) NOT LIKE '%responder_player_id%'
  ORDER BY conname
  LIMIT 1;

  IF current_name IS NULL THEN
    RAISE EXCEPTION 'fixture target-player invariant not found';
  END IF;

  EXECUTE format(
    'ALTER TABLE game_player_trade_offers DROP CONSTRAINT %I',
    current_name
  );

  ALTER TABLE game_player_trade_offers
    ADD CHECK (
      target_player_id IS NULL
      OR target_player_id <> proposer_player_id
    );
END
$$;

-- schema-v025.sql foi derivado do snapshot canônico antigo e portanto criou
-- alguns checks de 022/023 inline, sob nomes automáticos. O banco realmente
-- atualizado pelas migrations 021-023 possui os nomes semânticos abaixo.
DO $$
DECLARE
  current_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='game_player_trade_offers'::regclass
      AND conname='game_player_trade_offers_offered_descriptor_check'
  ) THEN
    SELECT conname INTO current_name
    FROM pg_constraint
    WHERE conrelid='game_player_trade_offers'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) LIKE '%offered_territory_id IS NOT NULL%'
      AND pg_get_constraintdef(oid) LIKE '%offered_symbol IS NOT NULL%'
      AND pg_get_constraintdef(oid) NOT LIKE '%counter_offered_kind%'
    ORDER BY conname
    LIMIT 1;

    IF current_name IS NULL THEN
      RAISE EXCEPTION 'fixture offered descriptor invariant not found';
    END IF;

    EXECUTE format(
      'ALTER TABLE game_player_trade_offers RENAME CONSTRAINT %I TO game_player_trade_offers_offered_descriptor_check',
      current_name
    );
  END IF;

  current_name := NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='game_player_trade_offers'::regclass
      AND conname='game_player_trade_offers_counter_descriptor_check'
  ) THEN
    SELECT conname INTO current_name
    FROM pg_constraint
    WHERE conrelid='game_player_trade_offers'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) LIKE '%counter_offered_kind%'
      AND pg_get_constraintdef(oid) LIKE '%counter_requested_kind%'
      AND pg_get_constraintdef(oid) NOT LIKE '%accepted_pending_selection%'
    ORDER BY conname
    LIMIT 1;

    IF current_name IS NULL THEN
      RAISE EXCEPTION 'fixture counter descriptor invariant not found';
    END IF;

    EXECUTE format(
      'ALTER TABLE game_player_trade_offers RENAME CONSTRAINT %I TO game_player_trade_offers_counter_descriptor_check',
      current_name
    );
  END IF;

  current_name := NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='game_player_trade_offers'::regclass
      AND conname='game_player_trade_offers_responder_check'
  ) THEN
    SELECT conname INTO current_name
    FROM pg_constraint
    WHERE conrelid='game_player_trade_offers'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) LIKE '%responder_player_id IS NULL%'
      AND pg_get_constraintdef(oid) LIKE '%target_player_id%'
      AND pg_get_constraintdef(oid) NOT LIKE '%status%'
    ORDER BY conname
    LIMIT 1;

    IF current_name IS NULL THEN
      RAISE EXCEPTION 'fixture responder invariant not found';
    END IF;

    EXECUTE format(
      'ALTER TABLE game_player_trade_offers RENAME CONSTRAINT %I TO game_player_trade_offers_responder_check',
      current_name
    );
  END IF;

  current_name := NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='game_player_trade_offers'::regclass
      AND conname='game_player_trade_offers_state_check'
  ) THEN
    SELECT conname INTO current_name
    FROM pg_constraint
    WHERE conrelid='game_player_trade_offers'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) LIKE '%accepted_pending_selection%'
      AND pg_get_constraintdef(oid) LIKE '%proposer_selected_card_id%'
      AND pg_get_constraintdef(oid) LIKE '%responder_selected_card_id%'
      AND pg_get_constraintdef(oid) LIKE '%resolved_at%'
    ORDER BY conname
    LIMIT 1;

    IF current_name IS NULL THEN
      RAISE EXCEPTION 'fixture state invariant not found';
    END IF;

    EXECUTE format(
      'ALTER TABLE game_player_trade_offers RENAME CONSTRAINT %I TO game_player_trade_offers_state_check',
      current_name
    );
  END IF;
END
$$;
