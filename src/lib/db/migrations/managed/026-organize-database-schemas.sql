-- Migration 026: organize application tables into domain schemas.
-- This file contains only the forward migration on purpose.
-- It is safe to execute as a whole in SQL editors such as Neon.
-- Rollback, if ever required, must be performed as an explicit separate operation.

-- Up Migration

CREATE SCHEMA IF NOT EXISTS game;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS ops;

DO $$
DECLARE
  relation RECORD;
  public_kind "char";
  legacy_target_kind "char";
  final_target_kind "char";
BEGIN
  FOR relation IN
    SELECT *
    FROM (VALUES
      ('game_rooms', 'game', 'rooms'),
      ('room_players', 'game', 'players'),
      ('game_territories', 'game', 'territories'),
      ('game_order_rolls', 'game', 'order_rolls'),
      ('game_rematch_votes', 'game', 'rematch_votes'),
      ('game_player_objectives', 'game', 'player_objectives'),
      ('game_cards', 'game', 'cards'),
      ('game_player_trade_offers', 'game', 'trade_offers'),
      ('game_round_events', 'game', 'round_events'),
      ('objectives', 'catalog', 'objectives'),
      ('objective_rules', 'catalog', 'objective_rules'),
      ('events', 'catalog', 'events'),
      ('event_connections', 'catalog', 'event_connections'),
      ('bot_names', 'catalog', 'bot_names'),
      ('territory_card_symbols', 'catalog', 'territory_card_symbols'),
      ('territory_connections', 'catalog', 'territory_connections'),
      ('game_command_receipts', 'ops', 'command_receipts')
    ) AS mapping(legacy_name, target_schema, final_name)
  LOOP
    public_kind := NULL;
    legacy_target_kind := NULL;
    final_target_kind := NULL;

    SELECT c.relkind
      INTO public_kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = relation.legacy_name;

    SELECT c.relkind
      INTO legacy_target_kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = relation.target_schema
       AND c.relname = relation.legacy_name;

    IF relation.final_name <> relation.legacy_name THEN
      SELECT c.relkind
        INTO final_target_kind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = relation.target_schema
         AND c.relname = relation.final_name;
    ELSE
      final_target_kind := legacy_target_kind;
    END IF;

    IF final_target_kind IN ('r', 'p') THEN
      IF public_kind IN ('r', 'p') OR
         (relation.final_name <> relation.legacy_name AND legacy_target_kind IN ('r', 'p')) THEN
        RAISE EXCEPTION
          'Ambiguous database state for %: multiple physical tables exist',
          relation.legacy_name;
      ELSIF public_kind IS NOT NULL AND public_kind <> 'v' THEN
        RAISE EXCEPTION
          'Unexpected relation public.% with relkind %',
          relation.legacy_name,
          public_kind;
      END IF;
    ELSIF legacy_target_kind IN ('r', 'p') THEN
      IF public_kind IN ('r', 'p') THEN
        RAISE EXCEPTION
          'Ambiguous database state: both public.% and %.% are physical tables',
          relation.legacy_name,
          relation.target_schema,
          relation.legacy_name;
      ELSIF public_kind IS NOT NULL AND public_kind <> 'v' THEN
        RAISE EXCEPTION
          'Unexpected relation public.% with relkind %',
          relation.legacy_name,
          public_kind;
      END IF;
    ELSIF public_kind IN ('r', 'p') THEN
      EXECUTE format(
        'ALTER TABLE public.%I SET SCHEMA %I',
        relation.legacy_name,
        relation.target_schema
      );
    ELSE
      RAISE EXCEPTION
        'Cannot organize %: public relkind %, legacy target relkind %, final target relkind %',
        relation.legacy_name,
        public_kind,
        legacy_target_kind,
        final_target_kind;
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  relation RECORD;
  selected_name TEXT;
BEGIN
  FOR relation IN
    SELECT *
    FROM (VALUES
      ('game_rooms', 'game', 'rooms'),
      ('room_players', 'game', 'players'),
      ('game_territories', 'game', 'territories'),
      ('game_order_rolls', 'game', 'order_rolls'),
      ('game_rematch_votes', 'game', 'rematch_votes'),
      ('game_player_objectives', 'game', 'player_objectives'),
      ('game_cards', 'game', 'cards'),
      ('game_player_trade_offers', 'game', 'trade_offers'),
      ('game_round_events', 'game', 'round_events'),
      ('objectives', 'catalog', 'objectives'),
      ('objective_rules', 'catalog', 'objective_rules'),
      ('events', 'catalog', 'events'),
      ('event_connections', 'catalog', 'event_connections'),
      ('bot_names', 'catalog', 'bot_names'),
      ('territory_card_symbols', 'catalog', 'territory_card_symbols'),
      ('territory_connections', 'catalog', 'territory_connections'),
      ('game_command_receipts', 'ops', 'command_receipts')
    ) AS mapping(legacy_name, target_schema, final_name)
  LOOP
    IF to_regclass(format('%I.%I', relation.target_schema, relation.final_name)) IS NOT NULL THEN
      selected_name := relation.final_name;
    ELSE
      selected_name := relation.legacy_name;
    END IF;

    EXECUTE format(
      'CREATE OR REPLACE VIEW public.%I AS SELECT * FROM %I.%I',
      relation.legacy_name,
      relation.target_schema,
      selected_name
    );
  END LOOP;
END
$$;
