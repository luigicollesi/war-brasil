import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("temporada expirada é encerrada antes de liberar nova ativação", () => {
  const migration = read(
    "src/lib/db/migrations/managed/074-battle-pass-season-lifecycle.sql",
  );

  assert.match(migration, /reconcile_battle_pass_season_lifecycle/);
  assert.match(migration, /SET status='ended'/);
  assert.match(migration, /ends_at <= CURRENT_TIMESTAMP/);
  assert.match(migration, /battle_pass_seasons_00_expired_rollover/);
  assert.match(
    migration,
    /PERFORM catalog\.reconcile_battle_pass_season_lifecycle\(\)/,
  );
});

test("reads da Campanha e início de match reconciliam ciclo sazonal", () => {
  const snapshot = read(
    "src/lib/server/progression/battle-pass-snapshot-service.ts",
  );
  const matchXp = read(
    "src/lib/server/progression/battle-pass-match-xp-service.ts",
  );

  assert.match(
    snapshot,
    /SELECT catalog\.reconcile_battle_pass_season_lifecycle\(\)/,
  );
  assert.match(
    matchXp,
    /SELECT catalog\.reconcile_battle_pass_season_lifecycle\(\)/,
  );
});
