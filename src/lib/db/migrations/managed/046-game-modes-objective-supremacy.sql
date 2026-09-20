-- Game Modes V1: room-level ruleset and dice-balance settings with immutable
-- per-match snapshots. match_mode remains an orthogonal classic/custom concept.

-- Up Migration

ALTER TABLE game.rooms
  ADD COLUMN IF NOT EXISTS ruleset TEXT NOT NULL DEFAULT 'objective',
  ADD COLUMN IF NOT EXISTS balanced_dice_enabled BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rooms_ruleset_check'
      AND conrelid = 'game.rooms'::regclass
  ) THEN
    ALTER TABLE game.rooms
      ADD CONSTRAINT rooms_ruleset_check
      CHECK (ruleset IN ('objective', 'supremacy'));
  END IF;
END
$$;

ALTER TABLE game.matches
  ADD COLUMN IF NOT EXISTS ruleset_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS balanced_dice_enabled_snapshot BOOLEAN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'matches_ruleset_snapshot_check'
      AND conrelid = 'game.matches'::regclass
  ) THEN
    ALTER TABLE game.matches
      ADD CONSTRAINT matches_ruleset_snapshot_check
      CHECK (
        ruleset_snapshot IS NULL
        OR ruleset_snapshot IN ('objective', 'supremacy')
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION game.reject_match_rule_snapshot_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'match rule snapshot fields are immutable after match creation';
END;
$$;

DROP TRIGGER IF EXISTS matches_rule_snapshot_immutable ON game.matches;
CREATE TRIGGER matches_rule_snapshot_immutable
BEFORE UPDATE OF match_mode_snapshot,ruleset_snapshot,balanced_dice_enabled_snapshot
ON game.matches
FOR EACH ROW
EXECUTE FUNCTION game.reject_match_rule_snapshot_mutation();

COMMENT ON COLUMN game.rooms.ruleset IS
  'Authoritative room ruleset. V1 supports objective and supremacy.';
COMMENT ON COLUMN game.rooms.balanced_dice_enabled IS
  'Authoritative room preference. TRUE uses the configured adaptive resolver; FALSE resolves uniform dice.';
COMMENT ON COLUMN game.matches.ruleset_snapshot IS
  'Ruleset captured when this concrete match starts. NULL is reserved for historical matches created before migration 043.';
COMMENT ON COLUMN game.matches.balanced_dice_enabled_snapshot IS
  'Dice-balance preference captured when this concrete match starts. NULL is reserved for historical matches created before migration 043.';
