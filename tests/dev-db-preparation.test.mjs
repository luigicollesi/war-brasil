import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const prepare = readFileSync("scripts/prepare-dev-db.mjs", "utf8");

test("ambiente dev prepara migrations necessárias antes de subir o Next", () => {
  assert.equal(
    packageJson.scripts.dev,
    "node scripts/prepare-dev-db.mjs && next dev",
  );
  assert.equal(
    packageJson.scripts["db:prepare:dev"],
    "node scripts/prepare-dev-db.mjs",
  );

  for (const migration of [
    "011-bot-players.sql",
    "012-bot-automation.sql",
    "013-objective-rules.sql",
    "014-balanced-objective-catalog.sql",
    "015-player-card-trade-count.sql",
    "016-disable-elimination-fallback.sql",
    "021-player-trade-phase.sql",
    "022-complete-player-trade-negotiation.sql",
  ]) {
    assert.match(prepare, new RegExp(migration.replaceAll(".", "\\.")));
  }
});

test("preparação do banco é transacional, convergente e não inicia o servidor", () => {
  assert.match(prepare, /BEGIN/);
  assert.match(prepare, /pg_advisory_xact_lock/);
  assert.match(prepare, /columnExists/);
  assert.match(prepare, /tableExists/);
  assert.match(prepare, /balancedCatalogReady/);
  assert.match(prepare, /COMMIT/);
  assert.match(prepare, /ROLLBACK/);
  assert.doesNotMatch(prepare, /next dev|next start|setInterval|setTimeout/);
});
