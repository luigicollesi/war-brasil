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

test("atribuição usa regras balanceadas por quantidade de jogadores e persiste snapshot", () => {
  const assignment = source(
    "src/lib/objectives/objective-assignment-service.ts",
  );
  const rooms = source("src/lib/rooms.ts");
  const rematch = source("src/lib/game-finish-command-service.ts");

  assert.match(assignment, /WHERE r\.player_count=\$1/);
  assert.match(assignment, /AND r\.is_active=TRUE/);
  assert.match(assignment, /objective_rule_id,target_player_id,resolved_params/);
  assert.match(assignment, /JSON\.stringify\(rule\.params\)/);
  assert.match(rooms, /await assignObjectives\(client, room\.id, players\)/);
  assert.match(rematch, /await assignObjectives\(client, roomId, players\)/);
});

test("avaliação usa snapshot apenas enquanto regra e objetivo continuam coerentes", () => {
  const service = source("src/lib/game-objective-service.ts");

  assert.match(service, /LEFT JOIN objective_rules r ON r\.id=a\.objective_rule_id/);
  assert.match(service, /CASE WHEN r\.objective_id=a\.objective_id THEN a\.resolved_params END/);
  assert.match(service, /JOIN objectives o ON o\.id=a\.objective_id/);
});
