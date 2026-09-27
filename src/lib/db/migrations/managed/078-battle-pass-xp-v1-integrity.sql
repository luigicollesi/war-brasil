-- Passe de Campanha V1: accumulated XP profile and 40k level curve guard.
-- Prevents activating a V1 season with XP values that diverge from the
-- approved accumulated-match model.
--
-- Up Migration

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_xp_v1_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  invalid_thresholds INTEGER;
  final_required_xp BIGINT;
  profile_valid BOOLEAN;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  WITH steps AS (
    SELECT
      level,
      (
        5 * ROUND(
          (
            225
            + 3 * (level - 1)
            + 0.01 * (level - 1) * (level - 1)
          ) / 5.0
        )
      )::bigint AS step_xp
    FROM generate_series(1,99) AS level
  ),
  expected AS (
    SELECT 1::smallint AS level,0::bigint AS required_total_xp
    UNION ALL
    SELECT
      (level + 1)::smallint,
      SUM(step_xp) OVER (ORDER BY level)::bigint
    FROM steps
  ),
  actual AS (
    SELECT level,required_total_xp
      FROM catalog.battle_pass_levels
     WHERE season_id=NEW.id
  )
  SELECT COUNT(*)::int
    INTO invalid_thresholds
    FROM expected
    FULL OUTER JOIN actual USING(level)
   WHERE expected.level IS NULL
      OR actual.level IS NULL
      OR expected.required_total_xp <> actual.required_total_xp;

  IF invalid_thresholds <> 0 THEN
    RAISE EXCEPTION
      'active battle pass XP thresholds do not match the approved 40k V1 curve';
  END IF;

  SELECT required_total_xp
    INTO final_required_xp
    FROM catalog.battle_pass_levels
   WHERE season_id=NEW.id AND level=100;

  IF final_required_xp <> 40000 THEN
    RAISE EXCEPTION
      'active battle pass level 100 must require exactly 40000 XP';
  END IF;

  SELECT (
    profile.action_model_version=2
    AND profile.troop_placed_xp=1
    AND profile.troop_placed_cap_xp=60
    AND profile.card_trade_xp=20
    AND profile.card_trade_cap_xp=80
    AND profile.troop_lost_dice_xp=1
    AND profile.troop_lost_dice_cap_xp=50
    AND profile.enemy_troop_defeated_xp=2
    AND profile.enemy_troop_defeated_cap_xp=100
    AND profile.territory_first_conquest_xp=25
    AND profile.territory_second_conquest_xp=10
    AND profile.completion_xp=150
    AND profile.victory_bonus_xp=200
    AND profile.solo_human_bot_multiplier_bps=4000
  )
  INTO profile_valid
  FROM catalog.battle_pass_xp_profiles profile
  WHERE profile.id=NEW.xp_profile_id;

  IF profile_valid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION
      'active battle pass XP profile does not match the approved accumulated V1 values';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_seasons_xp_v1_guard
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_seasons_xp_v1_guard
BEFORE INSERT OR UPDATE OF status,xp_profile_id
ON catalog.battle_pass_seasons
FOR EACH ROW
EXECUTE FUNCTION catalog.validate_battle_pass_xp_v1_activation();

COMMENT ON FUNCTION catalog.validate_battle_pass_xp_v1_activation() IS
  'Requires the exact 40,000 XP V1 curve and accumulated-match XP profile before a Battle Pass season can become active.';

-- Down Migration
-- V1 season progression history is durable; evolve through a forward migration.
