-- Migration 027: normalize physical table names inside domain schemas.
-- Legacy public views remain available until runtime SQL is migrated.

-- Up Migration

CREATE SCHEMA IF NOT EXISTS game;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS ops;

-- Bring map reference tables under catalog. If an older database does not
-- contain them yet, create the canonical empty structures below.
DO $$
DECLARE
  relation RECORD;
  public_kind "char";
  catalog_kind "char";
BEGIN
  FOR relation IN
    SELECT *
    FROM (VALUES
      ('territory_card_symbols'),
      ('territory_connections')
    ) AS mapping(table_name)
  LOOP
    public_kind := NULL;
    catalog_kind := NULL;

    SELECT c.relkind
      INTO public_kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = relation.table_name;

    SELECT c.relkind
      INTO catalog_kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'catalog'
       AND c.relname = relation.table_name;

    IF catalog_kind IN ('r', 'p') THEN
      IF public_kind IN ('r', 'p') THEN
        RAISE EXCEPTION
          'Ambiguous database state: both public.% and catalog.% are physical tables',
          relation.table_name,
          relation.table_name;
      ELSIF public_kind IS NOT NULL AND public_kind <> 'v' THEN
        RAISE EXCEPTION
          'Unexpected relation public.% with relkind %',
          relation.table_name,
          public_kind;
      END IF;
    ELSIF public_kind IN ('r', 'p') AND catalog_kind IS NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I SET SCHEMA catalog',
        relation.table_name
      );
    ELSIF public_kind IS NULL AND catalog_kind IS NULL THEN
      NULL;
    ELSE
      RAISE EXCEPTION
        'Cannot organize catalog.%: public relkind %, catalog relkind %',
        relation.table_name,
        public_kind,
        catalog_kind;
    END IF;
  END LOOP;
END
$$;

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

-- Keep object names aligned with their renamed tables. PostgreSQL preserves
-- existing constraint/index/sequence names when only the table is renamed.
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
