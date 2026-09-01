ALTER TABLE room_players
  ADD COLUMN IF NOT EXISTS bot_next_action_at TIMESTAMPTZ;
