-- Up Migration

CREATE SCHEMA IF NOT EXISTS game;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS ops;

DO $$
DECLARE
  relation RECORD;
  source_kind "char";
  target_kind "char";
BEGIN
  FOR relation IN
    SELECT *
    FROM (VALUES
      ('game_rooms', 'game'),
      ('room_players', 'game'),
      ('game_territories', 'game'),
      ('game_order_rolls', 'game'),
      ('game_rematch_votes', 'game'),
      ('game_player_objectives', 'game'),
      ('game_cards', 'game'),
      ('game_player_trade_offers', 'game'),
      ('game_round_events', 'game'),
      ('objectives', 'catalog'),
      ('objective_rules', 'catalog'),
      ('events', 'catalog'),
      ('event_connections', 'catalog'),
      ('bot_names', 'catalog'),
      ('game_command_receipts', 'ops')
    ) AS mapping(table_name, target_schema)
  LOOP
    SELECT c.relkind
      INTO source_kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = relation.table_name;

    SELECT c.relkind
      INTO target_kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = relation.target_schema
       AND c.relname = relation.table_name;

    IF target_kind IN ('r', 'p') THEN
      IF source_kind IN ('r', 'p') THEN
        RAISE EXCEPTION
          'Ambiguous database state: both public.% and %.% are physical tables',
          relation.table_name,
          relation.target_schema,
          relation.table_name;
      ELSIF source_kind IS NOT NULL AND source_kind <> 'v' THEN
        RAISE EXCEPTION
          'Unexpected relation public.% with relkind %',
          relation.table_name,
          source_kind;
      END IF;
    ELSIF source_kind IN ('r', 'p') AND target_kind IS NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I SET SCHEMA %I',
        relation.table_name,
        relation.target_schema
      );
    ELSE
      RAISE EXCEPTION
        'Cannot organize %.%: source relkind %, target relkind %',
        relation.target_schema,
        relation.table_name,
        source_kind,
        target_kind;
    END IF;

    source_kind := NULL;
    target_kind := NULL;
  END LOOP;
END
$$;

CREATE OR REPLACE VIEW public.game_rooms AS SELECT * FROM game.game_rooms;
CREATE OR REPLACE VIEW public.room_players AS SELECT * FROM game.room_players;
CREATE OR REPLACE VIEW public.game_territories AS SELECT * FROM game.game_territories;
CREATE OR REPLACE VIEW public.game_order_rolls AS SELECT * FROM game.game_order_rolls;
CREATE OR REPLACE VIEW public.game_rematch_votes AS SELECT * FROM game.game_rematch_votes;
CREATE OR REPLACE VIEW public.game_player_objectives AS SELECT * FROM game.game_player_objectives;
CREATE OR REPLACE VIEW public.game_cards AS SELECT * FROM game.game_cards;
CREATE OR REPLACE VIEW public.game_player_trade_offers AS SELECT * FROM game.game_player_trade_offers;
CREATE OR REPLACE VIEW public.game_round_events AS SELECT * FROM game.game_round_events;
CREATE OR REPLACE VIEW public.objectives AS SELECT * FROM catalog.objectives;
CREATE OR REPLACE VIEW public.objective_rules AS SELECT * FROM catalog.objective_rules;
CREATE OR REPLACE VIEW public.events AS SELECT * FROM catalog.events;
CREATE OR REPLACE VIEW public.event_connections AS SELECT * FROM catalog.event_connections;
CREATE OR REPLACE VIEW public.bot_names AS SELECT * FROM catalog.bot_names;
CREATE OR REPLACE VIEW public.game_command_receipts AS SELECT * FROM ops.game_command_receipts;

-- Down Migration

DROP VIEW IF EXISTS public.game_command_receipts;
DROP VIEW IF EXISTS public.bot_names;
DROP VIEW IF EXISTS public.event_connections;
DROP VIEW IF EXISTS public.events;
DROP VIEW IF EXISTS public.objective_rules;
DROP VIEW IF EXISTS public.objectives;
DROP VIEW IF EXISTS public.game_round_events;
DROP VIEW IF EXISTS public.game_player_trade_offers;
DROP VIEW IF EXISTS public.game_cards;
DROP VIEW IF EXISTS public.game_player_objectives;
DROP VIEW IF EXISTS public.game_rematch_votes;
DROP VIEW IF EXISTS public.game_order_rolls;
DROP VIEW IF EXISTS public.game_territories;
DROP VIEW IF EXISTS public.room_players;
DROP VIEW IF EXISTS public.game_rooms;

ALTER TABLE game.game_rooms SET SCHEMA public;
ALTER TABLE game.room_players SET SCHEMA public;
ALTER TABLE game.game_territories SET SCHEMA public;
ALTER TABLE game.game_order_rolls SET SCHEMA public;
ALTER TABLE game.game_rematch_votes SET SCHEMA public;
ALTER TABLE game.game_player_objectives SET SCHEMA public;
ALTER TABLE game.game_cards SET SCHEMA public;
ALTER TABLE game.game_player_trade_offers SET SCHEMA public;
ALTER TABLE game.game_round_events SET SCHEMA public;

ALTER TABLE catalog.objectives SET SCHEMA public;
ALTER TABLE catalog.objective_rules SET SCHEMA public;
ALTER TABLE catalog.events SET SCHEMA public;
ALTER TABLE catalog.event_connections SET SCHEMA public;
ALTER TABLE catalog.bot_names SET SCHEMA public;

ALTER TABLE ops.game_command_receipts SET SCHEMA public;

DROP SCHEMA IF EXISTS game;
DROP SCHEMA IF EXISTS catalog;
