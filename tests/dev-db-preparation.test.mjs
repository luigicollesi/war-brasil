import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const dev = readFileSync("scripts/dev.mjs", "utf8");
const prepare = readFileSync("scripts/prepare-dev-db.mjs", "utf8");
const envExample = readFileSync(".env.example", "utf8");
const agents = readFileSync("AGENTS.md", "utf8");
const schema = readFileSync("src/lib/db/schema.sql", "utf8");
const workflow = readFileSync(".github/workflows/test.yml", "utf8");
const nodeVersion = readFileSync(".nvmrc", "utf8").trim();
const orderRollPhaseMigration = readFileSync(
  "src/lib/db/migrations/024-order-roll-phase-compatibility.sql",
  "utf8",
);
const commandReceiptPatchMigration = readFileSync(
  "src/lib/db/migrations/025-command-receipt-patches.sql",
  "utf8",
);
const schemaOrganizationMigration = readFileSync(
  "src/lib/db/migrations/managed/026-organize-database-schemas.sql",
  "utf8",
);
const schemaNamingMigration = readFileSync(
  "src/lib/db/migrations/managed/027-normalize-schema-table-names.sql",
  "utf8",
);

test("ambiente dev prepara migrations gerenciadas antes de subir Next e realtime", () => {
  assert.equal(packageJson.scripts.dev, "node scripts/dev.mjs");
  assert.equal(
    packageJson.scripts["db:prepare:dev"],
    "node scripts/prepare-dev-db.mjs",
  );
  assert.equal(packageJson.scripts["db:migrate"], "node scripts/prepare-dev-db.mjs");
  assert.equal(
    packageJson.scripts["test:db"],
    'node --test "tests/integration/*.test.mjs"',
  );
  assert.match(dev, /scripts\/prepare-dev-db\.mjs/);
  assert.match(dev, /node_modules\/next\/dist\/bin\/next/);
  assert.match(dev, /realtime\/server\.mjs/);
  assert.match(dev, /env\.GAME_REALTIME_ENABLED = "true"/);
  assert.match(dev, /GAME_REALTIME_PATCHES_ENABLED/);
  assert.match(dev, /env\.NEXT_PUBLIC_GAME_REALTIME_MODE = "hybrid"/);
  assert.match(dev, /NEXT_PUBLIC_GAME_REALTIME_PORT/);
  assert.match(dev, /GAME_REALTIME_ALLOWED_ORIGINS/);
  assert.match(dev, /networkInterfaces\(\)/);
  assert.match(dev, /realtime\/node_modules\/ws\/package\.json/);
  assert.match(dev, /\["--prefix", "realtime", "ci"\]/);
});

test("referência de ambiente cobre banco, realtime local e automação sem fixar localhost no websocket", () => {
  for (const variable of [
    "DATABASE_URL",
    "GAME_REALTIME_ENABLED",
    "GAME_REALTIME_PORT",
    "GAME_REALTIME_EVENT_SOURCE",
    "GAME_REALTIME_AUTH_MODE",
    "NEXT_PUBLIC_GAME_REALTIME_MODE",
    "NEXT_PUBLIC_GAME_REALTIME_PORT",
    "NEXT_PUBLIC_GAME_AUTOMATION_DRIVER",
    "GAME_AUTOMATION_WORKER_MODE",
  ]) assert.match(envExample, new RegExp(`^${variable}=`, "m"));
  assert.doesNotMatch(
    envExample,
    /^NEXT_PUBLIC_GAME_REALTIME_URL=ws:\/\/localhost:/m,
  );
  assert.match(envExample, /GAME_REALTIME_ALLOWED_ORIGINS/);
  assert.match(envExample, /GAME_REALTIME_TICKET_SECRET/);
  assert.match(envExample, /GAME_REALTIME_REDIS_URL/);
});

test("contexto do projeto exige manter env example, schema e migrations sincronizados", () => {
  assert.match(agents, /\.env\.example.*canonical public reference/i);
  assert.match(agents, /src\/lib\/db\/migrations\/managed\//);
  assert.match(agents, /src\/lib\/db\/schema\.sql/);
  assert.match(agents, /scripts\/prepare-dev-db\.mjs/);
});

test("orquestrador dev mantém processos separados e encerra ambos em conjunto", () => {
  assert.match(dev, /spawn\(process\.execPath/);
  assert.match(dev, /start\("Next\.js"/);
  assert.match(dev, /start\("realtime gateway"/);
  assert.match(dev, /process\.on\("SIGINT"/);
  assert.match(dev, /process\.on\("SIGTERM"/);
  assert.match(dev, /child\.kill\(signal\)/);
  assert.doesNotMatch(dev, /GAME_REALTIME_ENABLED\s*=\s*"false"/);
});

test("dev realtime usa hostname do cliente e libera origins da máquina local", () => {
  const transport = readFileSync(
    "src/lib/client/transport/websocket-game-realtime-transport.ts",
    "utf8",
  );
  assert.match(transport, /window\.location\.hostname/);
  assert.match(transport, /NEXT_PUBLIC_GAME_REALTIME_PORT/);
  assert.doesNotMatch(transport, /ws:\/\/localhost:3001\/realtime/);
  assert.match(dev, /localDevelopmentOrigins/);
  assert.match(dev, /http:\/\/localhost:/);
  assert.match(dev, /http:\/\/127\.0\.0\.1:/);
});

test("preparação do banco usa ledger, ordem, lock, baseline e uma transação", () => {
  assert.match(prepare, /src\/lib\/db\/migrations\/managed/);
  assert.match(prepare, /migrationNamePattern/);
  assert.match(prepare, /assertMigrationHistory/);
  assert.match(prepare, /assertMigrationBaseline/);
  assert.match(prepare, /ops\.pgmigrations/);
  assert.match(prepare, /n\.nspname='game' AND c\.relname='rooms'/);
  assert.match(prepare, /territory_card_symbols/);
  assert.match(prepare, /territory_connections/);
  assert.match(prepare, /game_player_trade_offers_state_check/);
  assert.match(prepare, /Banco legado não corresponde ao baseline v025/);
  assert.match(prepare, /BEGIN/);
  assert.match(prepare, /pg_advisory_xact_lock/);
  assert.match(prepare, /COMMIT/);
  assert.match(prepare, /ROLLBACK/);
  assert.doesNotMatch(
    prepare,
    /columnExists|constraintExists|balancedCatalogReady|commandReceiptPatchesReady/,
  );
  assert.doesNotMatch(prepare, /next dev|next start|setInterval|setTimeout/);
});

test("fase 1 termina com schemas físicos normalizados e views legadas", () => {
  for (const schemaName of ["game", "catalog", "ops"]) {
    assert.match(schema, new RegExp(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`));
    assert.match(
      schemaOrganizationMigration,
      new RegExp(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`),
    );
  }

  for (const tableName of [
    "rooms",
    "players",
    "territories",
    "order_rolls",
    "rematch_votes",
    "player_objectives",
    "cards",
    "trade_offers",
    "round_events",
  ]) {
    assert.match(
      schema,
      new RegExp(`CREATE TABLE IF NOT EXISTS game\\.${tableName}\\b`),
    );
  }
  assert.match(schema, /CREATE TABLE IF NOT EXISTS ops\.command_receipts\b/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS catalog\.territory_card_symbols\b/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS catalog\.territory_connections\b/);
  assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS game\.game_rooms\b/);
  assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS game\.room_players\b/);
  assert.doesNotMatch(
    schema,
    /CREATE TABLE IF NOT EXISTS ops\.game_command_receipts\b/,
  );

  assert.match(schemaOrganizationMigration, /ALTER TABLE public\.%I SET SCHEMA %I/);
  assert.match(
    schemaOrganizationMigration,
    /'territory_card_symbols', 'catalog', 'territory_card_symbols'/,
  );
  assert.match(
    schemaOrganizationMigration,
    /'territory_connections', 'catalog', 'territory_connections'/,
  );

  assert.match(schemaNamingMigration, /'game', 'game_rooms', 'rooms'/);
  assert.match(schemaNamingMigration, /'game', 'room_players', 'players'/);
  assert.match(schemaNamingMigration, /'game', 'game_territories', 'territories'/);
  assert.match(schemaNamingMigration, /'game', 'game_cards', 'cards'/);
  assert.match(
    schemaNamingMigration,
    /'game', 'game_player_trade_offers', 'trade_offers'/,
  );
  assert.match(
    schemaNamingMigration,
    /'ops', 'game_command_receipts', 'command_receipts'/,
  );
  assert.doesNotMatch(
    schemaNamingMigration,
    /CREATE TABLE IF NOT EXISTS catalog\.territory_(?:card_symbols|connections)/,
  );
  assert.match(schemaNamingMigration, /trade_offers_target_player_check/);
  assert.match(schemaNamingMigration, /trade_offers_requested_descriptor_check/);
  assert.match(schemaNamingMigration, /trade_offers_responder_check/);
  assert.match(schemaNamingMigration, /trade_offers_state_check/);

  assert.match(
    schema,
    /CREATE OR REPLACE VIEW public\.game_rooms AS SELECT \* FROM game\.rooms/,
  );
  assert.match(
    schema,
    /CREATE OR REPLACE VIEW public\.territory_connections AS SELECT \* FROM catalog\.territory_connections/,
  );
  assert.match(
    schema,
    /CREATE OR REPLACE VIEW public\.game_command_receipts AS SELECT \* FROM ops\.command_receipts/,
  );
});

test("compatibilidade de fase permite cards somente durante order_roll", () => {
  for (const sql of [orderRollPhaseMigration, schema]) {
    assert.match(
      sql,
      /phase IN \('trade', 'reinforcement', 'attack', 'maneuver', 'end_turn', 'finished'\)/,
    );
    assert.match(sql, /phase = 'cards' AND status = 'order_roll'/);
    assert.doesNotMatch(sql, /phase IN \([^)]*'cards'/);
  }
});

test("receipts persistem patches públicos e privados para replay idempotente", () => {
  assert.match(
    commandReceiptPatchMigration,
    /ADD COLUMN IF NOT EXISTS response_patch JSONB/,
  );
  assert.match(
    commandReceiptPatchMigration,
    /ADD COLUMN IF NOT EXISTS response_private_patch JSONB/,
  );
  assert.match(schema, /response_patch JSONB/);
  assert.match(schema, /response_private_patch JSONB/);
});

test("CI usa PostgreSQL real e runtime Node atual", () => {
  assert.equal(nodeVersion, "24");
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-node@v7/);
  assert.match(workflow, /node-version-file:\s*\.nvmrc/);
  assert.match(workflow, /image:\s*postgres:18/);
  assert.match(workflow, /npm run test:db/);
  assert.doesNotMatch(workflow, /node-version:\s*20/);
  assert.equal(packageJson.scripts["test:run"], 'node --test "tests/*.test.mjs"');
  assert.equal(
    packageJson.scripts["worker:test"],
    'node --check worker/server.mjs && node --test "worker/test/*.test.mjs"',
  );
});
