ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS automation_claimed_by TEXT,
  ADD COLUMN IF NOT EXISTS automation_claimed_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS game_rooms_automation_claim_idx
  ON game_rooms (automation_due_at, automation_claimed_until, id)
  WHERE automation_due_at IS NOT NULL;
