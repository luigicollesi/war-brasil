-- Automatic Beta Tester promotion for newly persisted auth users.
-- Runs at the database boundary so credentials, OAuth and future auth methods
-- share the same idempotent grant path.
--
-- Up Migration

CREATE OR REPLACE FUNCTION profile.grant_beta_tester_on_auth_user_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  WITH granted AS (
    INSERT INTO profile.commander_titles(
      user_id,
      title_id,
      acquisition_source
    )
    SELECT
      NEW.id,
      title.id,
      'promotion'
    FROM catalog.commander_titles title
    WHERE title.id='title.beta-tester'
      AND title.is_active=TRUE
    ON CONFLICT (user_id, title_id) DO NOTHING
    RETURNING title_id
  )
  UPDATE catalog.commander_title_stats stats
     SET acquisition_count=stats.acquisition_count + 1,
         updated_at=NOW()
   WHERE stats.title_id IN (SELECT title_id FROM granted);

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS auth_user_beta_tester_after_insert ON auth."user";
CREATE TRIGGER auth_user_beta_tester_after_insert
AFTER INSERT ON auth."user"
FOR EACH ROW
EXECUTE FUNCTION profile.grant_beta_tester_on_auth_user_insert();

COMMENT ON FUNCTION profile.grant_beta_tester_on_auth_user_insert() IS
  'Idempotently grants the active Beta Tester commander title to every newly persisted auth user.';

-- Down Migration
-- Forward fixes are preferred because title ownership is durable user history.
