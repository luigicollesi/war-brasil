import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const dev = readFileSync("scripts/dev.mjs", "utf8");
const prepare = readFileSync("scripts/prepare-dev-db.mjs", "utf8");
const orderRollPhaseMigration = readFileSync(
  "src/lib/db/migrations/024-order-roll-phase-compatibility.sql",
  "utf8",
);

test("ambiente dev prepara migrations antes de subir Next e realtime", () => {
  assert.equal(packageJson.scripts.dev, "node scripts/dev.mjs");
  assert.equal(
    packageJson.scripts["db:prepare:dev"],
    "node scripts/prepare-dev-db.mjs",
  );
  assert.match(dev, /scripts\/prepare-dev-db\.mjs/);
  assert.match(dev, /node_modules\/next\/dist\/bin\/next/);
  assert.match(dev, /realtime\/server\.mjs/);
  assert.match(dev, /env\.GAME_REALTIME_ENABLED = "true"/);
  assert.match(dev, /env\.NEXT_PUBLIC_GAME_REALTIME_MODE = "hybrid"/);
  assert.match(dev, /NEXT_PUBLIC_GAME_REALTIME_PORT/);
  assert.match(dev, /GAME_REALTIME_ALLOWED_ORIGINS/);
  assert.match(dev, /networkInterfaces\(\)/);
  assert.match(dev, /realtime\/node_modules\/ws\/package\.json/);
  assert.match(dev, /\["--prefix", "realtime", "ci"\]/);

  for (const migration of [
    "011-bot-players.sql",
    "012-bot-automation.sql",
    "013-objective-rules.sql",
    "014-balanced-objective-catalog.sql",
    "015-player-card-trade-count.sql",
    "016-disable-elimination-fallback.sql",
    "021-player-trade-phase.sql",
    "022-complete-player-trade-negotiation.sql",
    "023-trade-negotiation-invariants.sql",
    "024-order-roll-phase-compatibility.sql",
  ]) {
    assert.match(prepare, new RegExp(migration.replaceAll(".", "\\.")));
  }
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

test("preparação do banco é transacional, convergente e não inicia o servidor", () => {
  assert.match(prepare, /BEGIN/);
  assert.match(prepare, /pg_advisory_xact_lock/);
  assert.match(prepare, /columnExists/);
  assert.match(prepare, /constraintExists/);
  assert.match(prepare, /tableExists/);
  assert.match(prepare, /balancedCatalogReady/);
  assert.match(prepare, /orderRollPhaseCompatibilityReady/);
  assert.match(prepare, /pg_get_constraintdef/);
  assert.match(prepare, /COMMIT/);
  assert.match(prepare, /ROLLBACK/);
  assert.doesNotMatch(prepare, /next dev|next start|setInterval|setTimeout/);
});

test("compatibilidade de fase permite cards somente durante order_roll", () => {
  assert.match(
    orderRollPhaseMigration,
    /phase IN \('trade', 'reinforcement', 'attack', 'maneuver', 'end_turn', 'finished'\)/,
  );
  assert.match(
    orderRollPhaseMigration,
    /phase = 'cards' AND status = 'order_roll'/,
  );
  assert.doesNotMatch(
    orderRollPhaseMigration,
    /phase IN \([^)]*'cards'/,
  );
});
