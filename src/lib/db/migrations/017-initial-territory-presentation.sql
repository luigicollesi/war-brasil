ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS initial_territory_presentation_started_at TIMESTAMPTZ;

ALTER TABLE game_territories
  ADD COLUMN IF NOT EXISTS initial_draw_order SMALLINT
    CHECK (initial_draw_order BETWEEN 1 AND 42);

UPDATE game_territories
SET initial_draw_order = territory_id
WHERE initial_draw_order IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS game_territories_room_initial_draw_order_idx
  ON game_territories(room_id, initial_draw_order)
  WHERE initial_draw_order IS NOT NULL;
