-- Preserva os deltas autoritativos do comando para que retries idempotentes
-- possam responder patch-first sem reconstruir ou repetir a mutação.

ALTER TABLE game_command_receipts
  ADD COLUMN IF NOT EXISTS response_patch JSONB,
  ADD COLUMN IF NOT EXISTS response_private_patch JSONB;
