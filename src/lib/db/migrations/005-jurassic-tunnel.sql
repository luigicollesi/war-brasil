ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS round_number INTEGER NOT NULL DEFAULT 1
    CHECK (round_number >= 1),
  ADD COLUMN IF NOT EXISTS jurassic_tunnel_territory_id SMALLINT
    CHECK (
      jurassic_tunnel_territory_id IS NULL
      OR (
        jurassic_tunnel_territory_id BETWEEN 1 AND 42
        AND jurassic_tunnel_territory_id NOT IN (1, 3)
      )
    );
