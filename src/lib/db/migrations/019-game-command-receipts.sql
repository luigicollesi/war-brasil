CREATE TABLE IF NOT EXISTS game_command_receipts (
  room_id BIGINT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  command_id UUID NOT NULL,
  command_name VARCHAR(80) NOT NULL,
  request_fingerprint CHAR(64) NOT NULL
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 1),
  base_revision INTEGER NOT NULL CHECK (base_revision >= 1),
  revision INTEGER NOT NULL CHECK (revision >= 2),
  response_value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id, command_id),
  CHECK (expected_revision = base_revision),
  CHECK (revision > base_revision)
);

CREATE INDEX IF NOT EXISTS game_command_receipts_room_created_idx
  ON game_command_receipts (room_id, created_at);
