-- Migration 027: normalize physical table names inside domain schemas.
-- Legacy public views remain available until runtime SQL is migrated.

-- Up Migration

CREATE SCHEMA IF NOT EXISTS game;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS ops;

-- Rename domain tables. Running this again is safe: a table already using the
-- final name is accepted, while ambiguous duplicate physical tables fail.
DO $$
DECLARE
  relation RECORD;
  legacy_kind "char";
  final_kind "char";
BEGIN
  FOR relation IN
    SELECT *
    FROM (VALUES
      ('game', 'game_rooms', 'rooms'),
      ('game', 'room_players', 'players'),
      ('game', 'game_territories', 'territories'),
      ('game', 'game_order_rolls', 'order_rolls'),
      ('game', 'game_rematch_votes', 'rematch_votes'),
      ('game', 'game_player_objectives', 'player_objectives'),
      ('game', 'game_cards', 'cards'),
      ('game', 'game_player_trade_offers', 'trade_offers'),
      ('game', 'game_round_events', 'round_events'),
      ('ops', 'game_command_receipts', 'command_receipts')
    ) AS mapping(schema_name, legacy_name, final_name)
  LOOP
    legacy_kind := NULL;
    final_kind := NULL;

    SELECT c.relkind
      INTO legacy_kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = relation.schema_name
       AND c.relname = relation.legacy_name;

    SELECT c.relkind
      INTO final_kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = relation.schema_name
       AND c.relname = relation.final_name;

    IF final_kind IN ('r', 'p') AND legacy_kind IS NULL THEN
      NULL;
    ELSIF legacy_kind IN ('r', 'p') AND final_kind IS NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.%I RENAME TO %I',
        relation.schema_name,
        relation.legacy_name,
        relation.final_name
      );
    ELSIF legacy_kind IN ('r', 'p') AND final_kind IN ('r', 'p') THEN
      RAISE EXCEPTION
        'Ambiguous database state: both %.% and %.% are physical tables',
        relation.schema_name,
        relation.legacy_name,
        relation.schema_name,
        relation.final_name;
    ELSE
      RAISE EXCEPTION
        'Cannot rename %.% to %: legacy relkind %, final relkind %',
        relation.schema_name,
        relation.legacy_name,
        relation.final_name,
        legacy_kind,
        final_kind;
    END IF;
  END LOOP;
END
$$;

-- PostgreSQL preserves constraint, index and sequence names when a table is
-- renamed. Normalize those dependent object names as part of the same phase.
DO $$
DECLARE
  relation RECORD;
  object_record RECORD;
  new_object_name TEXT;
BEGIN
  FOR relation IN
    SELECT *
    FROM (VALUES
      ('game', 'game_rooms', 'rooms'),
      ('game', 'room_players', 'players'),
      ('game', 'game_territories', 'territories'),
      ('game', 'game_order_rolls', 'order_rolls'),
      ('game', 'game_rematch_votes', 'rematch_votes'),
      ('game', 'game_player_objectives', 'player_objectives'),
      ('game', 'game_cards', 'cards'),
      ('game', 'game_player_trade_offers', 'trade_offers'),
      ('game', 'game_round_events', 'round_events'),
      ('ops', 'game_command_receipts', 'command_receipts')
    ) AS mapping(schema_name, legacy_name, final_name)
  LOOP
    FOR object_record IN
      SELECT c.conname AS object_name
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = relation.schema_name
        AND t.relname = relation.final_name
        AND left(c.conname, length(relation.legacy_name) + 1) = relation.legacy_name || '_'
      ORDER BY c.conname
    LOOP
      new_object_name := relation.final_name || substr(
        object_record.object_name,
        length(relation.legacy_name) + 1
      );

      IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = relation.schema_name
          AND t.relname = relation.final_name
          AND c.conname = new_object_name
      ) THEN
        RAISE EXCEPTION
          'Cannot rename constraint % to % on %.%: target name already exists',
          object_record.object_name,
          new_object_name,
          relation.schema_name,
          relation.final_name;
      END IF;

      EXECUTE format(
        'ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I',
        relation.schema_name,
        relation.final_name,
        object_record.object_name,
        new_object_name
      );
    END LOOP;

    FOR object_record IN
      SELECT index_class.relname AS object_name
      FROM pg_index i
      JOIN pg_class table_class ON table_class.oid = i.indrelid
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      JOIN pg_class index_class ON index_class.oid = i.indexrelid
      WHERE table_namespace.nspname = relation.schema_name
        AND table_class.relname = relation.final_name
        AND left(index_class.relname, length(relation.legacy_name) + 1) = relation.legacy_name || '_'
      ORDER BY index_class.relname
    LOOP
      new_object_name := relation.final_name || substr(
        object_record.object_name,
        length(relation.legacy_name) + 1
      );

      IF to_regclass(format('%I.%I', relation.schema_name, new_object_name)) IS NOT NULL THEN
        RAISE EXCEPTION
          'Cannot rename index % to % in schema %: target name already exists',
          object_record.object_name,
          new_object_name,
          relation.schema_name;
      END IF;

      EXECUTE format(
        'ALTER INDEX %I.%I RENAME TO %I',
        relation.schema_name,
        object_record.object_name,
        new_object_name
      );
    END LOOP;

    FOR object_record IN
      SELECT sequence_class.relname AS object_name
      FROM pg_class sequence_class
      JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_class.relnamespace
      JOIN pg_depend dependency
        ON dependency.objid = sequence_class.oid
       AND dependency.deptype = 'a'
      JOIN pg_class table_class ON table_class.oid = dependency.refobjid
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      WHERE sequence_class.relkind = 'S'
        AND sequence_namespace.nspname = relation.schema_name
        AND table_namespace.nspname = relation.schema_name
        AND table_class.relname = relation.final_name
        AND left(sequence_class.relname, length(relation.legacy_name) + 1) = relation.legacy_name || '_'
      ORDER BY sequence_class.relname
    LOOP
      new_object_name := relation.final_name || substr(
        object_record.object_name,
        length(relation.legacy_name) + 1
      );

      IF to_regclass(format('%I.%I', relation.schema_name, new_object_name)) IS NOT NULL THEN
        RAISE EXCEPTION
          'Cannot rename sequence % to % in schema %: target name already exists',
          object_record.object_name,
          new_object_name,
          relation.schema_name;
      END IF;

      EXECUTE format(
        'ALTER SEQUENCE %I.%I RENAME TO %I',
        relation.schema_name,
        object_record.object_name,
        new_object_name
      );
    END LOOP;
  END LOOP;
END
$$;

-- The trade negotiation history mixes explicitly named constraints from 022/023
-- with two older anonymous checks from 021. Converge the complete semantic set
-- so upgraded and clean databases expose the same names.
DO $$
DECLARE
  current_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='game' AND t.relname='trade_offers'
      AND c.conname='trade_offers_target_player_check'
  ) THEN
    SELECT c.conname INTO current_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='game' AND t.relname='trade_offers' AND c.contype='c'
      AND pg_get_constraintdef(c.oid) LIKE '%target_player_id IS NULL%'
      AND pg_get_constraintdef(c.oid) LIKE '%proposer_player_id%'
    ORDER BY c.conname
    LIMIT 1;

    IF current_name IS NULL THEN
      RAISE EXCEPTION 'trade_offers target-player invariant not found';
    END IF;

    EXECUTE format(
      'ALTER TABLE game.trade_offers RENAME CONSTRAINT %I TO trade_offers_target_player_check',
      current_name
    );
  END IF;

  current_name := NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='game' AND t.relname='trade_offers'
      AND c.conname='trade_offers_requested_descriptor_check'
  ) THEN
    SELECT c.conname INTO current_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='game' AND t.relname='trade_offers' AND c.contype='c'
      AND pg_get_constraintdef(c.oid) LIKE '%requested_territory_id IS NOT NULL%'
      AND pg_get_constraintdef(c.oid) LIKE '%requested_symbol IS NOT NULL%'
      AND pg_get_constraintdef(c.oid) NOT LIKE '%counter_requested_kind%'
    ORDER BY c.conname
    LIMIT 1;

    IF current_name IS NULL THEN
      RAISE EXCEPTION 'trade_offers requested descriptor invariant not found';
    END IF;

    EXECUTE format(
      'ALTER TABLE game.trade_offers RENAME CONSTRAINT %I TO trade_offers_requested_descriptor_check',
      current_name
    );
  END IF;

  current_name := NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='game' AND t.relname='trade_offers'
      AND c.conname='trade_offers_responder_check'
  ) THEN
    SELECT c.conname INTO current_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='game' AND t.relname='trade_offers' AND c.contype='c'
      AND pg_get_constraintdef(c.oid) LIKE '%responder_player_id IS NULL%'
      AND pg_get_constraintdef(c.oid) LIKE '%target_player_id%'
      AND pg_get_constraintdef(c.oid) NOT LIKE '%status%'
    ORDER BY c.conname
    LIMIT 1;

    IF current_name IS NULL THEN
      RAISE EXCEPTION 'trade_offers responder invariant not found';
    END IF;

    EXECUTE format(
      'ALTER TABLE game.trade_offers RENAME CONSTRAINT %I TO trade_offers_responder_check',
      current_name
    );
  END IF;

  current_name := NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='game' AND t.relname='trade_offers'
      AND c.conname='trade_offers_state_check'
  ) THEN
    SELECT c.conname INTO current_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='game' AND t.relname='trade_offers' AND c.contype='c'
      AND pg_get_constraintdef(c.oid) LIKE '%accepted_pending_selection%'
      AND pg_get_constraintdef(c.oid) LIKE '%proposer_selected_card_id%'
      AND pg_get_constraintdef(c.oid) LIKE '%responder_selected_card_id%'
      AND pg_get_constraintdef(c.oid) LIKE '%resolved_at%'
    ORDER BY c.conname
    LIMIT 1;

    IF current_name IS NULL THEN
      RAISE EXCEPTION 'trade_offers state invariant not found';
    END IF;

    EXECUTE format(
      'ALTER TABLE game.trade_offers RENAME CONSTRAINT %I TO trade_offers_state_check',
      current_name
    );
  END IF;
END
$$;

-- Legacy public API for the current application runtime.
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
