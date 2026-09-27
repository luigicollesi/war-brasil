-- Passe de Campanha V1: authoritative season lifecycle rollover.
-- Expired active rows are moved to ended so claim windows can remain visible
-- without blocking the next season's unique active slot.
--
-- Up Migration

CREATE OR REPLACE FUNCTION catalog.reconcile_battle_pass_season_lifecycle()
RETURNS INTEGER
LANGUAGE plpgsql
AS $body$
DECLARE
  changed INTEGER;
BEGIN
  UPDATE catalog.battle_pass_seasons
     SET status='ended',
         updated_at=NOW()
   WHERE status='active'
     AND ends_at <= CURRENT_TIMESTAMP;

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END
$body$;

CREATE OR REPLACE FUNCTION catalog.rollover_expired_battle_pass_before_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  IF NEW.status='active' AND OLD.status IS DISTINCT FROM 'active' THEN
    PERFORM catalog.reconcile_battle_pass_season_lifecycle();
  END IF;
  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_seasons_00_expired_rollover
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_seasons_00_expired_rollover
BEFORE UPDATE OF status ON catalog.battle_pass_seasons
FOR EACH ROW
EXECUTE FUNCTION catalog.rollover_expired_battle_pass_before_activation();

COMMENT ON FUNCTION catalog.reconcile_battle_pass_season_lifecycle() IS
  'Moves time-expired active Battle Pass seasons to ended while preserving their claim window.';
COMMENT ON TRIGGER battle_pass_seasons_00_expired_rollover
  ON catalog.battle_pass_seasons IS
  'Runs before the activation validator so an expired season cannot block the next active season.';

-- Down Migration
-- Seasonal lifecycle state is durable; prefer forward migrations.
