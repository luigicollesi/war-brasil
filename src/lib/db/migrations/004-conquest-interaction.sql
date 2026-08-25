ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS pending_from_territory_id SMALLINT
    CHECK (pending_from_territory_id BETWEEN 1 AND 42),
  ADD COLUMN IF NOT EXISTS pending_to_territory_id SMALLINT
    CHECK (pending_to_territory_id BETWEEN 1 AND 42),
  ADD COLUMN IF NOT EXISTS last_battle JSONB;

ALTER TABLE game_rooms
  ADD CONSTRAINT game_rooms_pending_conquest_pair_check
  CHECK (
    (pending_from_territory_id IS NULL AND pending_to_territory_id IS NULL)
    OR (pending_from_territory_id IS NOT NULL AND pending_to_territory_id IS NOT NULL)
  );
