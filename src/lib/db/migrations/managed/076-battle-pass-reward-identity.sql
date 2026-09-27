-- Passe de Campanha V1: reward identity integrity before activation.
-- The V1 layout already validates positions and slots in 072; this migration
-- ensures those positions represent distinct seasonal items rather than
-- repeating the same catalog ownership across multiple milestones.
--
-- Up Migration

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_reward_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  distinct_dice_count INTEGER;
  distinct_territory_count INTEGER;
  distinct_background_count INTEGER;
  distinct_title_count INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(DISTINCT reward.cosmetic_id) FILTER (
      WHERE reward.reward_kind='game_cosmetic'
        AND cosmetic.slot IN ('dice_attack','dice_defense','dice_neutral')
    ),
    COUNT(DISTINCT reward.cosmetic_id) FILTER (
      WHERE reward.reward_kind='game_cosmetic'
        AND cosmetic.slot='territory_skin'
    ),
    COUNT(DISTINCT reward.background_id) FILTER (
      WHERE reward.reward_kind='profile_background'
    ),
    COUNT(DISTINCT reward.title_id) FILTER (
      WHERE reward.reward_kind='commander_title'
    )
  INTO
    distinct_dice_count,
    distinct_territory_count,
    distinct_background_count,
    distinct_title_count
  FROM catalog.battle_pass_rewards reward
  LEFT JOIN catalog.cosmetics cosmetic
    ON cosmetic.id=reward.cosmetic_id
  WHERE reward.season_id=NEW.id;

  IF distinct_dice_count <> 9 THEN
    RAISE EXCEPTION
      'active battle pass requires 9 distinct seasonal dice rewards';
  END IF;

  IF distinct_territory_count <> 3 THEN
    RAISE EXCEPTION
      'active battle pass requires 3 distinct seasonal territory skins';
  END IF;

  IF distinct_background_count <> 2 THEN
    RAISE EXCEPTION
      'active battle pass requires 2 distinct seasonal backgrounds';
  END IF;

  IF distinct_title_count <> 2 THEN
    RAISE EXCEPTION
      'active battle pass requires distinct free and Elite level-100 titles';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_seasons_reward_identity_guard
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_seasons_reward_identity_guard
BEFORE INSERT OR UPDATE OF status
ON catalog.battle_pass_seasons
FOR EACH ROW
EXECUTE FUNCTION catalog.validate_battle_pass_reward_identity();

COMMENT ON FUNCTION catalog.validate_battle_pass_reward_identity() IS
  'Requires the 16 V1 cosmetic reward positions to resolve to 9 distinct dice, 3 distinct territory skins, 2 backgrounds and 2 titles before activation.';

-- Down Migration
-- Seasonal catalog integrity is forward-only once a season can be activated.
