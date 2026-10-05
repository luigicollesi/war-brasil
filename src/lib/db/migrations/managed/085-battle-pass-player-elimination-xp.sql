-- Battle Pass: +100 XP for eliminating a player.
-- Adds an append-only profile field with a safe default for the active V1 profile,
-- extends the action ledger, and guards future active-season profiles.
--
-- Up Migration

ALTER TABLE catalog.battle_pass_xp_profiles
  ADD COLUMN IF NOT EXISTS player_elimination_xp INTEGER NOT NULL DEFAULT 100
    CHECK (player_elimination_xp >= 0);

DO $body$
DECLARE
  row RECORD;
BEGIN
  FOR row IN
    SELECT constraint_row.conname
      FROM pg_constraint constraint_row
     WHERE constraint_row.conrelid =
           'progression.battle_pass_match_xp_actions'::regclass
       AND constraint_row.contype='c'
       AND pg_get_constraintdef(constraint_row.oid) ILIKE '%action_kind%'
  LOOP
    EXECUTE format(
      'ALTER TABLE progression.battle_pass_match_xp_actions DROP CONSTRAINT %I',
      row.conname
    );
  END LOOP;
END
$body$;

ALTER TABLE progression.battle_pass_match_xp_actions
  ADD CONSTRAINT battle_pass_match_xp_actions_action_kind_check
  CHECK (
    action_kind IN (
      'troops_placed',
      'card_trade',
      'combat',
      'territory_conquest',
      'player_elimination'
    )
  );

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_elimination_xp_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  profile_valid BOOLEAN;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT profile.player_elimination_xp=100
    INTO profile_valid
    FROM catalog.battle_pass_xp_profiles profile
   WHERE profile.id=NEW.xp_profile_id;

  IF profile_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION
      'active battle pass player elimination XP must be exactly 100';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_seasons_elimination_xp_v1_guard
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_seasons_elimination_xp_v1_guard
BEFORE INSERT OR UPDATE OF status,xp_profile_id
ON catalog.battle_pass_seasons
FOR EACH ROW
EXECUTE FUNCTION catalog.validate_battle_pass_elimination_xp_v1();

COMMENT ON COLUMN catalog.battle_pass_xp_profiles.player_elimination_xp IS
  'Raw Battle Pass XP granted to the conqueror that removes a player final territory.';

COMMENT ON FUNCTION catalog.validate_battle_pass_elimination_xp_v1() IS
  'Requires +100 raw XP per player elimination for active Battle Pass V1 seasons.';

-- Existing active V1 profile rows receive the DEFAULT 100 through ADD COLUMN.
-- Existing match snapshots intentionally do not gain the new field mid-match;
-- the application interprets a missing snapshot field as zero for compatibility.
--
-- Down Migration
-- Battle Pass action history is durable progression state; evolve forward only.
