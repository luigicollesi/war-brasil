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

test("validador fail-fast cobre banco, secret forte e todos os providers aprovados", () => {
  for (const required of [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "APPLE_CLIENT_ID",
    "APPLE_TEAM_ID",
    "APPLE_KEY_ID",
    "APPLE_PRIVATE_KEY",
  ]) {
    assert.ok(
      environmentSource.includes(required),
      `validador não cobre ${required}`,
    );
  }
  assert.match(environmentSource, /AUTH_SECRET_MIN_LENGTH = 32/);
});
