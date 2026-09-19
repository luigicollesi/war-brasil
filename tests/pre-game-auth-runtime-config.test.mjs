import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const authSource = await readFile("src/lib/server/auth/auth.ts", "utf8");
const environmentSource = await readFile(
  "src/lib/server/auth/environment.ts",
  "utf8",
);

test("produção real executa o validador de configuração antes de criar Better Auth", () => {
  assert.match(
    authSource,
    /process\.env\.NODE_ENV === "production"[\s\S]*assertAuthRuntimeConfiguration\(environment\)/,
  );
  assert.ok(
    authSource.indexOf("assertAuthRuntimeConfiguration(environment)") <
      authSource.indexOf("betterAuth({"),
    "validação precisa acontecer antes da instância Better Auth",
  );
});

test("exceção do harness exige CI explícito e sink de email controlado", () => {
  assert.match(authSource, /process\.env\.CI === "true"/);
  assert.match(authSource, /AUTH_EMAIL_SINK_DIR/);
  assert.match(
    authSource,
    /process\.env\.NODE_ENV === "production" && !isControlledCiHarness/,
  );
});

test("validador fail-fast cobre URL HTTPS, banco, secret forte, email e providers aprovados", () => {
  for (const required of [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "AUTH_EMAIL_FROM",
    "AUTH_EMAIL_TRANSPORT",
    "EMAIL_TRANSPORT_SECRET",
    "AUTH_EMAIL_GOOGLE_CLIENT_ID",
    "AUTH_EMAIL_GOOGLE_CLIENT_SECRET",
    "AUTH_EMAIL_GOOGLE_REFRESH_TOKEN",
  ]) {
    assert.ok(
      environmentSource.includes(required),
      `validador não cobre ${required}`,
    );
  }
  assert.doesNotMatch(environmentSource, /APPLE_/);
  assert.match(environmentSource, /AUTH_SECRET_MIN_LENGTH = 32/);
  assert.match(environmentSource, /url\.protocol === "https:"/);
  assert.match(environmentSource, /!url\.username && !url\.password/);
  assert.match(environmentSource, /isValidEmailFrom/);
  assert.match(environmentSource, /isObviouslyUnsafeTransportSecret/);
});


test("produção aceita email por Resend ou Gmail OAuth e exige refresh token completo quando selecionado", () => {
  assert.match(environmentSource, /"gmail-oauth"/);
  assert.match(environmentSource, /"resend"/);
  assert.match(environmentSource, /AUTH_EMAIL_GOOGLE_CLIENT_ID/);
  assert.match(environmentSource, /AUTH_EMAIL_GOOGLE_CLIENT_SECRET/);
  assert.match(environmentSource, /AUTH_EMAIL_GOOGLE_REFRESH_TOKEN/);
  assert.match(environmentSource, /EMAIL_TRANSPORT_SECRET/);
});
