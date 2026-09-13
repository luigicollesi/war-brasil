-- Better Auth persistent rate-limit storage.
-- Keeps abuse counters shared across serverless/runtime instances.

-- Up Migration

CREATE TABLE IF NOT EXISTS auth."rateLimit" (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL CHECK (count >= 0),
  "lastRequest" BIGINT NOT NULL CHECK ("lastRequest" >= 0)
);

COMMENT ON TABLE auth."rateLimit" IS
  'Better Auth database-backed rate-limit counters; not application profile state.';
