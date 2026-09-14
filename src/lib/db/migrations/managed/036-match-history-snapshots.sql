-- Durable per-match history snapshots for PROFILE V3.
-- Rooms and player seats may be reused by rematches, so historical identity/result
-- must be captured per game.matches row instead of inferred from current room state.

-- Up Migration

ALTER TABLE game.matches
  ADD COLUMN IF NOT EXISTS match_mode_snapshot TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname='matches_match_mode_snapshot_check'
       AND conrelid='game.matches'::regclass
  ) THEN
    ALTER TABLE game.matches
      ADD CONSTRAINT matches_match_mode_snapshot_check
      CHECK (
        match_mode_snapshot IS NULL
        OR match_mode_snapshot IN ('classic', 'custom')
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS game.match_participants (
  match_id BIGINT NOT NULL
    REFERENCES game.matches(id) ON DELETE CASCADE,
  player_id_snapshot BIGINT NOT NULL,
  user_id UUID
    REFERENCES auth."user"(id) ON DELETE SET NULL,
  display_name_snapshot VARCHAR(48) NOT NULL,
  handle_snapshot VARCHAR(32),
  faction_name_snapshot VARCHAR(32) NOT NULL,
  color_snapshot VARCHAR(16) NOT NULL
    CHECK (color_snapshot IN ('forest', 'ocean', 'sun', 'ruby', 'violet', 'orange')),
  is_bot BOOLEAN NOT NULL,
  is_winner BOOLEAN,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, player_id_snapshot),
  CHECK (btrim(display_name_snapshot) <> ''),
  CHECK (handle_snapshot IS NULL OR btrim(handle_snapshot) <> ''),
  CHECK (btrim(faction_name_snapshot) <> '')
);

CREATE INDEX IF NOT EXISTS match_participants_user_match_idx
  ON game.match_participants (user_id, match_id DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS match_participants_match_result_idx
  ON game.match_participants (match_id, is_winner);

COMMENT ON COLUMN game.matches.match_mode_snapshot IS
  'Mode captured when this match starts. NULL is allowed only for matches created before migration 036.';
COMMENT ON TABLE game.match_participants IS
  'Append-only public identity/result snapshots for one concrete match/rematch. Historical display data survives account deletion.';
COMMENT ON COLUMN game.match_participants.player_id_snapshot IS
  'Historical seat id only; intentionally not a foreign key because seats may later be deleted.';
COMMENT ON COLUMN game.match_participants.user_id IS
  'Optional current account link for history lookup; ON DELETE SET NULL preserves the historical snapshot.';
COMMENT ON COLUMN game.match_participants.is_winner IS
  'TRUE/FALSE for known outcomes; NULL when an outcome is unavailable or cannot be reconstructed safely.';
