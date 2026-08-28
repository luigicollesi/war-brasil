CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  effects JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- As tabelas de catálogo podem já existir em bancos criados antes desta migration.
-- Os ALTERs abaixo tornam a migration idempotente sem apagar ou reescrever dados.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS effects JSONB DEFAULT '[]'::jsonb;

ALTER TABLE events
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN effects SET DEFAULT '[]'::jsonb,
  ALTER COLUMN effects SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_id_nonnegative_check'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_id_nonnegative_check CHECK (id >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_effects_array_check'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_effects_array_check
      CHECK (jsonb_typeof(effects) = 'array');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS event_connections (
  from_event INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  to_event INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  weight INTEGER NOT NULL,
  PRIMARY KEY (from_event, to_event)
);

ALTER TABLE event_connections
  ADD COLUMN IF NOT EXISTS weight INTEGER;

ALTER TABLE event_connections
  ALTER COLUMN from_event SET NOT NULL,
  ALTER COLUMN to_event SET NOT NULL,
  ALTER COLUMN weight SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_connections_from_event_fkey'
      AND conrelid = 'event_connections'::regclass
  ) THEN
    ALTER TABLE event_connections
      ADD CONSTRAINT event_connections_from_event_fkey
      FOREIGN KEY (from_event) REFERENCES events(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_connections_to_event_fkey'
      AND conrelid = 'event_connections'::regclass
  ) THEN
    ALTER TABLE event_connections
      ADD CONSTRAINT event_connections_to_event_fkey
      FOREIGN KEY (to_event) REFERENCES events(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_connections_weight_positive_check'
      AND conrelid = 'event_connections'::regclass
  ) THEN
    ALTER TABLE event_connections
      ADD CONSTRAINT event_connections_weight_positive_check
      CHECK (weight > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_connections_no_initial_destination_check'
      AND conrelid = 'event_connections'::regclass
  ) THEN
    ALTER TABLE event_connections
      ADD CONSTRAINT event_connections_no_initial_destination_check
      CHECK (to_event <> 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_connections_no_self_loop_check'
      AND conrelid = 'event_connections'::regclass
  ) THEN
    ALTER TABLE event_connections
      ADD CONSTRAINT event_connections_no_self_loop_check
      CHECK (from_event <> to_event);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS event_connections_from_to_uidx
  ON event_connections(from_event, to_event);

CREATE TABLE IF NOT EXISTS game_round_events (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  resolved_effects JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(resolved_effects) = 'array'),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, round_number)
);

CREATE INDEX IF NOT EXISTS game_round_events_event_id_idx
  ON game_round_events(event_id);
