ALTER TABLE room_players
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS bot_names (
  id BIGSERIAL PRIMARY KEY,
  color VARCHAR(16) NOT NULL
    CHECK (color IN ('forest', 'ocean', 'sun', 'ruby', 'violet', 'orange')),
  name VARCHAR(32) NOT NULL,
  UNIQUE (color, name)
);

INSERT INTO bot_names (color, name) VALUES
  ('forest', 'Integralistas'),
  ('forest', 'Cabanos'),
  ('forest', 'Conselheiristas'),
  ('forest', 'Federalistas'),
  ('ocean', 'Luzias'),
  ('ocean', 'Praieiros'),
  ('ocean', 'Exaltados'),
  ('ocean', 'Armada'),
  ('sun', 'Emboabas'),
  ('sun', 'Mascates'),
  ('sun', 'Balaios'),
  ('sun', 'Constitucionalistas'),
  ('ruby', 'Maragatos'),
  ('ruby', 'Farroupilhas'),
  ('ruby', 'Malês'),
  ('ruby', 'Tenentistas'),
  ('violet', 'Saquaremas'),
  ('violet', 'Caramurus'),
  ('violet', 'Restauradores'),
  ('violet', 'Áulicos'),
  ('orange', 'Chimangos'),
  ('orange', 'Pica-Paus'),
  ('orange', 'Sabinistas'),
  ('orange', 'Castilhistas')
ON CONFLICT (color, name) DO NOTHING;
