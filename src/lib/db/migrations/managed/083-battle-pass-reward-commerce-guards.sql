-- Passe de Campanha V1: close inverse commerce membership paths for seasonal rewards.
--
-- Migration 082 prevents an active offer from being opened for a product that
-- already contains a live/historical Battle Pass reward. These complementary
-- guards prevent attaching a Battle Pass reward to a product whose direct
-- offer is already active.
--
-- Archived seasons are intentionally excluded so gameplay collections and
-- profile backgrounds may be commercialized later. Completion titles retain
-- their stricter permanent guards from migration 082.
--
-- Up Migration

CREATE OR REPLACE FUNCTION catalog.reject_battle_pass_reward_gameplay_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM catalog.battle_pass_rewards reward
      JOIN catalog.battle_pass_seasons season
        ON season.id=reward.season_id
     WHERE reward.reward_kind='game_cosmetic'
       AND reward.cosmetic_id=NEW.cosmetic_id
       AND season.status IN ('announced','active','ended')
  ) AND EXISTS (
    SELECT 1
      FROM catalog.offers offer
     WHERE offer.product_id=NEW.product_id
       AND offer.active=TRUE
       AND offer.status='available'
  ) THEN
    RAISE EXCEPTION
      'battle pass reward cosmetic % cannot be attached to product % while that product has an active direct offer',
      NEW.cosmetic_id,
      NEW.product_id
      USING ERRCODE='check_violation';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_reward_gameplay_membership_guard
  ON catalog.product_items;
CREATE TRIGGER battle_pass_reward_gameplay_membership_guard
BEFORE INSERT OR UPDATE OF product_id,cosmetic_id
ON catalog.product_items
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_battle_pass_reward_gameplay_membership();

CREATE OR REPLACE FUNCTION catalog.reject_battle_pass_reward_entitlement_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  reward_is_locked BOOLEAN := FALSE;
BEGIN
  IF NEW.entitlement_kind='profile_background' AND NEW.background_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
        FROM catalog.battle_pass_rewards reward
        JOIN catalog.battle_pass_seasons season
          ON season.id=reward.season_id
       WHERE reward.reward_kind='profile_background'
         AND reward.background_id=NEW.background_id
         AND season.status IN ('announced','active','ended')
    )
    INTO reward_is_locked;
  ELSIF NEW.entitlement_kind='commander_title' AND NEW.title_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
        FROM catalog.battle_pass_rewards reward
        JOIN catalog.battle_pass_seasons season
          ON season.id=reward.season_id
       WHERE reward.reward_kind='commander_title'
         AND reward.title_id=NEW.title_id
         AND season.status IN ('announced','active','ended')
    )
    INTO reward_is_locked;
  END IF;

  IF reward_is_locked AND EXISTS (
    SELECT 1
      FROM catalog.offers offer
     WHERE offer.product_id=NEW.product_id
       AND offer.active=TRUE
       AND offer.status='available'
  ) THEN
    RAISE EXCEPTION
      'battle pass reward entitlement cannot be attached to product % while that product has an active direct offer',
      NEW.product_id
      USING ERRCODE='check_violation';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_reward_entitlement_membership_guard
  ON catalog.product_entitlements;
CREATE TRIGGER battle_pass_reward_entitlement_membership_guard
BEFORE INSERT OR UPDATE OF
  product_id,entitlement_kind,background_id,title_id
ON catalog.product_entitlements
FOR EACH ROW
WHEN (
  NEW.entitlement_kind IN ('profile_background','commander_title')
)
EXECUTE FUNCTION catalog.reject_battle_pass_reward_entitlement_membership();

COMMENT ON FUNCTION catalog.reject_battle_pass_reward_gameplay_membership() IS
  'Prevents attaching seasonal Battle Pass gameplay rewards to products with active direct offers until the season is archived.';

COMMENT ON FUNCTION catalog.reject_battle_pass_reward_entitlement_membership() IS
  'Prevents attaching seasonal Battle Pass background/title rewards to products with active direct offers until the season is archived.';

-- Down Migration
-- Reward exclusivity is intentionally forward-only while seasonal history exists.
