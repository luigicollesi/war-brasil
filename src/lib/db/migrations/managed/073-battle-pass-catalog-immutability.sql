-- Passe de Campanha V1: freeze live/historical seasonal catalog and keep
-- XP policies append-only after the activation validator introduced in 072.
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

COMMENT ON FUNCTION catalog.reject_locked_battle_pass_child_mutation() IS
  'Prevents live or historical seasonal levels, rewards and pricing from drifting after activation.';

-- Down Migration
-- Live/historical Battle Pass catalog is intentionally forward-only.
