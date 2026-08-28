ALTER TABLE game_round_events
  ADD COLUMN IF NOT EXISTS applied_troop_changes JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'game_round_events_applied_troop_changes_array_check'
      AND conrelid = 'game_round_events'::regclass
  ) THEN
    ALTER TABLE game_round_events
      ADD CONSTRAINT game_round_events_applied_troop_changes_array_check
      CHECK (jsonb_typeof(applied_troop_changes) = 'array');
  END IF;
END
$$;
