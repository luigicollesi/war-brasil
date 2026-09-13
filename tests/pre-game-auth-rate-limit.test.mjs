import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auth = readFileSync("src/lib/server/auth/auth.ts", "utf8");
const migration = readFileSync(
  "src/lib/db/migrations/managed/033-auth-rate-limit.sql",
  "utf8",
);

test("Better Auth usa rate limit persistente, inclusive fora de produção", () => {
  assert.match(auth, /rateLimit:\s*\{/);
  assert.match(auth, /enabled: true/);
  assert.match(auth, /storage: "database"/);
  assert.match(auth, /modelName: "rateLimit"/);
  assert.doesNotMatch(auth, /storage: "memory"/);
});

test("operações credentials sensíveis possuem regras explícitas", () => {
  for (const path of [
    "/sign-in/email",
    "/sign-up/email",
    "/send-verification-email",
    "/request-password-reset",
  ]) {
    assert.match(auth, new RegExp(`"${path.replaceAll("/", "\\/")}"`), path);
  }

  assert.match(auth, /CREDENTIAL_LOGIN_MAX = 5/);
  assert.match(auth, /CREDENTIAL_SIGNUP_MAX = 5/);
  assert.match(auth, /AUTH_EMAIL_ACTION_MAX = 3/);
});

test("migration 033 materializa o schema oficial do limiter no schema auth", () => {
  assert.match(migration, /-- Up Migration/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS auth\."rateLimit"/);
  assert.match(migration, /id UUID PRIMARY KEY/);
  assert.match(migration, /key TEXT NOT NULL UNIQUE/);
  assert.match(migration, /count INTEGER NOT NULL/);
  assert.match(migration, /"lastRequest" BIGINT NOT NULL/);
});
