import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("migração de regras de objetivo é expansiva e cobre partidas de 2 a 6 jogadores", () => {
  const migration = source("src/lib/db/migrations/013-objective-rules.sql");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS objective_rules/);
  assert.match(migration, /player_count BETWEEN 2 AND 6/);
  assert.match(migration, /UNIQUE \(objective_id, player_count, revision\)/);
  assert.match(migration, /WHERE is_active = TRUE/);
  assert.match(migration, /generate_series\(2, 6\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS objective_rule_id/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS resolved_params/);
  assert.doesNotMatch(migration, /DROP COLUMN/);
  assert.doesNotMatch(migration, /DROP TABLE/);
});

test("avaliação usa snapshot de parâmetros e mantém fallback para atribuições legadas", () => {
  const service = source("src/lib/game-objective-service.ts");

  assert.match(service, /COALESCE\(a\.resolved_params,o\.params\) params/);
  assert.match(service, /JOIN objectives o ON o\.id=a\.objective_id/);
});
