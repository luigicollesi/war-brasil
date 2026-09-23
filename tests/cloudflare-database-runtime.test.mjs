import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtimePool = readFileSync(
  "src/lib/server/db/runtime-pool.ts",
  "utf8",
);
const databasePool = readFileSync(
  "src/lib/server/db/pool.ts",
  "utf8",
);
const authPool = readFileSync(
  "src/lib/server/auth/auth-pool.ts",
  "utf8",
);
const health = readFileSync(
  "src/app/api/health/route.ts",
  "utf8",
);
const proxy = readFileSync("src/proxy.ts", "utf8");
const smoke = readFileSync("scripts/cloudflare-smoke.mjs", "utf8");
const wrangler = readFileSync("wrangler.jsonc", "utf8");

test("Cloudflare resolve pg Pool por ExecutionContext e reutiliza conexões apenas no request", () => {
  assert.match(runtimePool, /getCloudflareContext/);
  assert.match(runtimePool, /WeakMap<object, Pool>/);
  assert.match(runtimePool, /WORKER_MAX_CONNECTIONS = 5/);
  assert.match(runtimePool, /workerMaxConnections/);
  assert.doesNotMatch(runtimePool, /maxUses:\s*:\s*1/);
  assert.match(runtimePool, /connectionTimeoutMillis/);
  assert.match(runtimePool, /idleTimeoutMillis/);
  assert.match(runtimePool, /statement_timeout/);
  assert.match(runtimePool, /query_timeout/);
  assert.match(runtimePool, /lock_timeout/);
  assert.match(runtimePool, /idle_in_transaction_session_timeout/);
  assert.match(runtimePool, /createWorkerRequestPool/);
  assert.match(runtimePool, /Reflect\.apply\(method, selected, args\)/);
});

test("Wrangler declara Hyperdrive real para o banco principal", () => {
  assert.match(wrangler, /"hyperdrive"\s*:/);
  assert.match(
    wrangler,
    /"binding"\s*:\s*"DATABASE_HYPERDRIVE"/,
  );
  assert.match(wrangler, /"id"\s*:\s*"[a-f0-9]{32}"/i);
  assert.doesNotMatch(
    wrangler,
    /<your-hyperdrive-id-here>|ID_REAL_DO_HYPERDRIVE/,
  );
});

test("Node mantém Pool persistente enquanto Worker usa facade request-scoped", () => {
  assert.match(databasePool, /persistentPool/);
  assert.match(databasePool, /createRuntimePool/);
  assert.match(databasePool, /hyperdriveBinding: "DATABASE_HYPERDRIVE"/);
  assert.match(databasePool, /DATABASE_HYPERDRIVE_URL/);
  assert.match(databasePool, /hyperdriveOriginConnectionString/);
  assert.match(databasePool, /isNeonPooledConnectionString/);
  assert.match(databasePool, /max: process\.env\["NEXT_PHASE"\]/);
  assert.match(authPool, /persistentAuthPool/);
  assert.match(authPool, /createRuntimePool/);
  assert.match(authPool, /workerConfig: \(\) => authPoolConfig\(2\)/);
});

test("auth preserva conexão direta e search_path dedicado sem pool Worker global", () => {
  assert.match(authPool, /options: "-c search_path=auth"/);
  assert.match(authPool, /isNeonPooledConnectionString/);
  assert.match(authPool, /AUTH_DATABASE_URL ou DATABASE_URL/);
  assert.doesNotMatch(
    authPool,
    /export const authPool = globalForAuthPostgres\.warBrasilAuthPool \?\?/,
  );
});

test("health público prova banco principal e schema auth na implantação real", () => {
  assert.match(health, /pool\.query\("SELECT 1"\)/);
  assert.match(health, /authPool\.query/);
  assert.match(health, /current_schema\(\)/);
  assert.match(health, /schema_name !== "auth"/);
  assert.match(proxy, /api\/health/);
  assert.match(smoke, /\/api\/health/);
  assert.match(smoke, /healthPayload\?\.ok/);
});
