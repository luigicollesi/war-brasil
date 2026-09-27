-- Passe de Campanha V1: freeze live seasonal catalog and validate the
-- complete 100-level reward matrix before activation.
--
-- Up Migration

CREATE OR REPLACE FUNCTION catalog.reject_battle_pass_xp_profile_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  RAISE EXCEPTION
    'battle pass XP profiles are append-only; create a new profile version instead';
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_xp_profiles_append_only
  ON catalog.battle_pass_xp_profiles;
CREATE TRIGGER battle_pass_xp_profiles_append_only
BEFORE UPDATE OR DELETE ON catalog.battle_pass_xp_profiles
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_battle_pass_xp_profile_mutation();

CREATE OR REPLACE FUNCTION catalog.guard_battle_pass_season_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  IF OLD.status='active' AND NEW.status NOT IN ('active','ended') THEN
    RAISE EXCEPTION 'active battle pass can only remain active or become ended';
  END IF;

  IF OLD.status='ended' AND NEW.status NOT IN ('ended','archived') THEN
    RAISE EXCEPTION 'ended battle pass can only remain ended or become archived';
  END IF;

  IF OLD.status='archived' AND NEW.status <> 'archived' THEN
    RAISE EXCEPTION 'archived battle pass cannot be reopened';
  END IF;

  IF OLD.status IN ('active','ended','archived')
     AND ROW(
       OLD.slug,
       OLD.name,
       OLD.description,
       OLD.starts_at,
       OLD.ends_at,
       OLD.claim_ends_at,
       OLD.max_level,
       OLD.xp_profile_id,
       OLD.hero_asset_ref,
       OLD.logo_asset_ref
     ) IS DISTINCT FROM ROW(
       NEW.slug,
       NEW.name,
       NEW.description,
       NEW.starts_at,
       NEW.ends_at,
       NEW.claim_ends_at,
       NEW.max_level,
       NEW.xp_profile_id,
       NEW.hero_asset_ref,
       NEW.logo_asset_ref
     ) THEN
    RAISE EXCEPTION
      'active or historical battle pass catalog is immutable';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_seasons_mutation_guard
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_seasons_mutation_guard
BEFORE UPDATE ON catalog.battle_pass_seasons
FOR EACH ROW
EXECUTE FUNCTION catalog.guard_battle_pass_season_mutation();

CREATE OR REPLACE FUNCTION catalog.reject_locked_battle_pass_child_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  old_status VARCHAR(16);
  new_status VARCHAR(16);
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT status
      INTO old_status
      FROM catalog.battle_pass_seasons
     WHERE id=OLD.season_id;

    IF old_status IN ('active','ended','archived') THEN
      RAISE EXCEPTION
        'active or historical battle pass child catalog is immutable';
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT status
      INTO new_status
      FROM catalog.battle_pass_seasons
     WHERE id=NEW.season_id;

    IF new_status IN ('active','ended','archived') THEN
      RAISE EXCEPTION
        'active or historical battle pass child catalog is immutable';
    END IF;
  END IF;

  IF TG_OP='DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_levels_mutation_guard
  ON catalog.battle_pass_levels;
CREATE TRIGGER battle_pass_levels_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON catalog.battle_pass_levels
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_locked_battle_pass_child_mutation();

DROP TRIGGER IF EXISTS battle_pass_rewards_mutation_guard
  ON catalog.battle_pass_rewards;
CREATE TRIGGER battle_pass_rewards_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON catalog.battle_pass_rewards
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_locked_battle_pass_child_mutation();

DROP TRIGGER IF EXISTS battle_pass_pricing_mutation_guard
  ON catalog.battle_pass_pricing;
CREATE TRIGGER battle_pass_pricing_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON catalog.battle_pass_pricing
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_locked_battle_pass_child_mutation();

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  level_count INTEGER;
  level_one_xp BIGINT;
  credit_mismatch_count INTEGER;
  reward_mismatch_count INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::int,
         MAX(required_total_xp) FILTER (WHERE level=1)
    INTO level_count,level_one_xp
    FROM catalog.battle_pass_levels
   WHERE season_id=NEW.id;

  IF level_count <> 100 THEN
    RAISE EXCEPTION 'active battle pass requires exactly 100 levels';
  END IF;

  IF level_one_xp IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'active battle pass level 1 must start at 0 XP';
  END IF;

  WITH expected(track,level,amount) AS (
    VALUES
      ('free'::varchar,2::smallint,5::bigint),
      ('free'::varchar,4::smallint,15::bigint),
      ('free'::varchar,7::smallint,30::bigint),
      ('free'::varchar,10::smallint,50::bigint),
      ('free'::varchar,12::smallint,5::bigint),
      ('free'::varchar,14::smallint,15::bigint),
      ('free'::varchar,17::smallint,30::bigint),
      ('free'::varchar,20::smallint,50::bigint),
      ('free'::varchar,22::smallint,5::bigint),
      ('free'::varchar,24::smallint,15::bigint),
      ('free'::varchar,27::smallint,30::bigint),
      ('free'::varchar,30::smallint,50::bigint),
      ('free'::varchar,32::smallint,5::bigint),
      ('free'::varchar,34::smallint,15::bigint),
      ('free'::varchar,37::smallint,30::bigint),
      ('free'::varchar,40::smallint,50::bigint),
      ('free'::varchar,42::smallint,5::bigint),
      ('free'::varchar,44::smallint,15::bigint),
      ('free'::varchar,47::smallint,30::bigint),
      ('free'::varchar,50::smallint,50::bigint),
      ('free'::varchar,52::smallint,5::bigint),
      ('free'::varchar,54::smallint,15::bigint),
      ('free'::varchar,57::smallint,30::bigint),
      ('free'::varchar,60::smallint,50::bigint),
      ('free'::varchar,62::smallint,5::bigint),
      ('free'::varchar,64::smallint,15::bigint),
      ('free'::varchar,67::smallint,30::bigint),
      ('free'::varchar,70::smallint,50::bigint),
      ('free'::varchar,72::smallint,5::bigint),
      ('free'::varchar,74::smallint,15::bigint),
      ('free'::varchar,77::smallint,30::bigint),
      ('free'::varchar,80::smallint,50::bigint),
      ('free'::varchar,82::smallint,5::bigint),
      ('free'::varchar,84::smallint,15::bigint),
      ('free'::varchar,87::smallint,30::bigint),
      ('free'::varchar,90::smallint,50::bigint),
      ('free'::varchar,92::smallint,5::bigint),
      ('free'::varchar,94::smallint,15::bigint),
      ('free'::varchar,97::smallint,30::bigint),
      ('free'::varchar,99::smallint,50::bigint),
      ('premium'::varchar,1::smallint,5::bigint),
      ('premium'::varchar,3::smallint,20::bigint),
      ('premium'::varchar,5::smallint,50::bigint),
      ('premium'::varchar,8::smallint,75::bigint),
      ('premium'::varchar,10::smallint,100::bigint),
      ('premium'::varchar,11::smallint,5::bigint),
      ('premium'::varchar,13::smallint,20::bigint),
      ('premium'::varchar,15::smallint,50::bigint),
      ('premium'::varchar,18::smallint,75::bigint),
      ('premium'::varchar,20::smallint,100::bigint),
      ('premium'::varchar,21::smallint,5::bigint),
      ('premium'::varchar,23::smallint,20::bigint),
      ('premium'::varchar,25::smallint,50::bigint),
      ('premium'::varchar,28::smallint,75::bigint),
      ('premium'::varchar,30::smallint,100::bigint),
      ('premium'::varchar,31::smallint,5::bigint),
      ('premium'::varchar,33::smallint,20::bigint),
      ('premium'::varchar,35::smallint,50::bigint),
      ('premium'::varchar,38::smallint,75::bigint),
      ('premium'::varchar,40::smallint,100::bigint),
      ('premium'::varchar,41::smallint,5::bigint),
      ('premium'::varchar,43::smallint,20::bigint),
      ('premium'::varchar,45::smallint,50::bigint),
      ('premium'::varchar,48::smallint,75::bigint),
      ('premium'::varchar,50::smallint,100::bigint),
      ('premium'::varchar,51::smallint,5::bigint),
      ('premium'::varchar,53::smallint,20::bigint),
      ('premium'::varchar,55::smallint,50::bigint),
      ('premium'::varchar,58::smallint,75::bigint),
      ('premium'::varchar,60::smallint,100::bigint),
      ('premium'::varchar,61::smallint,5::bigint),
      ('premium'::varchar,63::smallint,20::bigint),
      ('premium'::varchar,65::smallint,50::bigint),
      ('premium'::varchar,68::smallint,75::bigint),
      ('premium'::varchar,70::smallint,100::bigint),
      ('premium'::varchar,71::smallint,5::bigint),
      ('premium'::varchar,73::smallint,20::bigint),
      ('premium'::varchar,75::smallint,50::bigint),
      ('premium'::varchar,78::smallint,75::bigint),
      ('premium'::varchar,80::smallint,100::bigint),
      ('premium'::varchar,81::smallint,5::bigint),
      ('premium'::varchar,83::smallint,20::bigint),
      ('premium'::varchar,85::smallint,50::bigint),
      ('premium'::varchar,88::smallint,75::bigint),
      ('premium'::varchar,90::smallint,100::bigint),
      ('premium'::varchar,91::smallint,5::bigint),
      ('premium'::varchar,93::smallint,20::bigint),
      ('premium'::varchar,95::smallint,50::bigint),
      ('premium'::varchar,98::smallint,75::bigint),
      ('premium'::varchar,99::smallint,100::bigint)
  ),
  actual AS (
    SELECT reward.track,
           reward.level,
           SUM(reward.credit_amount)::bigint AS amount
      FROM catalog.battle_pass_rewards reward
     WHERE reward.season_id=NEW.id
       AND reward.reward_kind='campaign_credit'
     GROUP BY reward.track,reward.level
  )
  SELECT COUNT(*)::int
    INTO credit_mismatch_count
    FROM expected
    FULL JOIN actual
      ON actual.track=expected.track
     AND actual.level=expected.level
   WHERE expected.track IS NULL
      OR actual.track IS NULL
      OR actual.amount IS DISTINCT FROM expected.amount;

  IF credit_mismatch_count <> 0 THEN
    RAISE EXCEPTION
      'active battle pass campaign-credit schedule does not match V1';
  END IF;

  WITH expected(track,level,reward_kind,slot,quantity) AS (
    VALUES
      ('free'::varchar,15::smallint,'game_cosmetic'::varchar,'dice_attack'::text,1::int),
      ('free'::varchar,35::smallint,'game_cosmetic'::varchar,'dice_defense'::text,1::int),
      ('free'::varchar,55::smallint,'game_cosmetic'::varchar,'dice_neutral'::text,1::int),
      ('free'::varchar,75::smallint,'game_cosmetic'::varchar,'territory_skin'::text,1::int),
      ('free'::varchar,90::smallint,'profile_background'::varchar,NULL::text,1::int),
      ('free'::varchar,100::smallint,'commander_title'::varchar,NULL::text,1::int),
      ('premium'::varchar,1::smallint,'game_cosmetic'::varchar,'dice_attack'::text,1::int),
      ('premium'::varchar,1::smallint,'game_cosmetic'::varchar,'dice_defense'::text,1::int),
      ('premium'::varchar,1::smallint,'game_cosmetic'::varchar,'dice_neutral'::text,1::int),
      ('premium'::varchar,1::smallint,'game_cosmetic'::varchar,'territory_skin'::text,1::int),
      ('premium'::varchar,60::smallint,'game_cosmetic'::varchar,'dice_attack'::text,1::int),
      ('premium'::varchar,70::smallint,'game_cosmetic'::varchar,'dice_defense'::text,1::int),
      ('premium'::varchar,80::smallint,'game_cosmetic'::varchar,'dice_neutral'::text,1::int),
      ('premium'::varchar,90::smallint,'game_cosmetic'::varchar,'territory_skin'::text,1::int),
      ('premium'::varchar,95::smallint,'profile_background'::varchar,NULL::text,1::int),
      ('premium'::varchar,100::smallint,'commander_title'::varchar,NULL::text,1::int)
  ),
  actual AS (
    SELECT reward.track,
           reward.level,
           reward.reward_kind,
           cosmetic.slot::text AS slot,
           COUNT(*)::int AS quantity
      FROM catalog.battle_pass_rewards reward
      LEFT JOIN catalog.cosmetics cosmetic
        ON cosmetic.id=reward.cosmetic_id
     WHERE reward.season_id=NEW.id
       AND reward.reward_kind <> 'campaign_credit'
     GROUP BY
       reward.track,
       reward.level,
       reward.reward_kind,
       cosmetic.slot
  )
  SELECT COUNT(*)::int
    INTO reward_mismatch_count
    FROM expected
    FULL JOIN actual
      ON actual.track=expected.track
     AND actual.level=expected.level
     AND actual.reward_kind=expected.reward_kind
     AND actual.slot IS NOT DISTINCT FROM expected.slot
   WHERE expected.track IS NULL
      OR actual.track IS NULL
      OR actual.quantity IS DISTINCT FROM expected.quantity;

  IF reward_mismatch_count <> 0 THEN
    RAISE EXCEPTION
      'active battle pass cosmetic/title/background schedule does not match V1';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM catalog.battle_pass_pricing pricing
     WHERE pricing.season_id=NEW.id
       AND pricing.fixed_price=3000
  ) THEN
    RAISE EXCEPTION
      'active battle pass requires the 3000 campaign-credit Elite price';
  END IF;

  RETURN NEW;
END
$body$;

COMMENT ON FUNCTION catalog.validate_battle_pass_activation() IS
  'Validates the complete V1 100-level reward schedule before a season can become active.';
COMMENT ON FUNCTION catalog.reject_locked_battle_pass_child_mutation() IS
  'Prevents live or historical seasonal levels, rewards and pricing from drifting after activation.';

-- Down Migration
-- Live/historical Battle Pass catalog is intentionally forward-only.
