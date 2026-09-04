ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS automation_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS automation_kind VARCHAR(20)
    CHECK (automation_kind IS NULL OR automation_kind IN ('presentation', 'bot'));

CREATE INDEX IF NOT EXISTS game_rooms_automation_due_idx
  ON game_rooms (automation_due_at, id)
  WHERE automation_due_at IS NOT NULL;
