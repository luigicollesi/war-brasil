CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY CHECK (id >= 0),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  effects JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(effects) = 'array')
);

CREATE TABLE IF NOT EXISTS event_connections (
  from_event INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  to_event INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  weight INTEGER NOT NULL CHECK (weight > 0),
  PRIMARY KEY (from_event, to_event),
  CHECK (to_event <> 0)
);

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

-- O catálogo histórico e o grafo já existem no banco da aplicação, mas ainda
-- não possuem uma versão canônica no repositório. Eles serão adicionados em
-- uma migration de dados separada para evitar reconstruir os registros no chute.
