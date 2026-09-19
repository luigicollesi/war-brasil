-- Pending email/password registrations.
-- No auth.user/auth.account row exists until the email OTP is confirmed.

CREATE TABLE IF NOT EXISTS auth.pending_registration (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_ciphertext TEXT NOT NULL,
  verification_code_hash TEXT NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  code_expires_at TIMESTAMPTZ NOT NULL,
  resend_available_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (attempts >= 0 AND attempts <= 5)
);

CREATE INDEX IF NOT EXISTS pending_registration_code_expiry_idx
  ON auth.pending_registration (code_expires_at);

COMMENT ON TABLE auth.pending_registration IS
  'Short-lived email/password signup state. Promoted to Better Auth user/account only after OTP confirmation.';
COMMENT ON COLUMN auth.pending_registration.password_ciphertext IS
  'AES-256-GCM encrypted temporary password; never plaintext and deleted after promotion.';
COMMENT ON COLUMN auth.pending_registration.verification_code_hash IS
  'HMAC-SHA256 of the one-time verification code; the raw OTP is never persisted.';
