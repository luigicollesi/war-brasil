-- Age eligibility gate for authenticated Bellum Civile accounts.
-- Birth date is private authentication/onboarding data and is never part of the
-- public commander profile.
--
-- Up Migration

CREATE TABLE IF NOT EXISTS auth.user_age_eligibility (
  user_id UUID PRIMARY KEY
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  birth_date DATE NOT NULL,
  minimum_age_at_verification SMALLINT NOT NULL DEFAULT 10
    CHECK (minimum_age_at_verification BETWEEN 1 AND 120),
  verification_method VARCHAR(24) NOT NULL DEFAULT 'self_declared'
    CHECK (verification_method IN ('self_declared')),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE auth.user_age_eligibility IS
  'Private age-gate record. Stores date of birth so age can be derived without persisting a stale numeric age.';
COMMENT ON COLUMN auth.user_age_eligibility.birth_date IS
  'Private date of birth used only for eligibility and age-related policy enforcement.';
COMMENT ON COLUMN auth.user_age_eligibility.minimum_age_at_verification IS
  'Minimum age policy enforced when the birth date was accepted.';

INSERT INTO ops.pgmigrations(name)
VALUES('057-auth-age-eligibility.sql')
ON CONFLICT (name) DO NOTHING;

-- Down Migration
-- Forward fixes are preferred because age eligibility is security/policy state.
