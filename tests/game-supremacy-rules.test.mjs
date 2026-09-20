import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const victory = readFileSync("src/lib/server/game-victory-service.ts", "utf8");
const supremacy = readFileSync("src/lib/server/game-supremacy-service.ts", "utf8");
const objective = readFileSync("src/lib/server/game-objective-service.ts", "utf8");

const commandFiles = [
  "src/lib/server/game-battle-service.ts",
  "src/lib/server/game-troop-command-service.ts",
  "src/lib/server/game-conquest-command-service.ts",
  "src/lib/server/game-command-service.ts",
  "src/lib/server/game-maneuver-command-service.ts",
];

test("dispatcher seleciona policy pelo ruleset autoritativo do match", () => {
  assert.match(victory, /ruleset_snapshot/);
  assert.match(victory, /objectiveVictoryConditionMet/);
  assert.match(victory, /supremacyVictoryConditionMet/);
  assert.match(victory, /export async function evaluateGameVictory/);
});

test("supremacia exige total positivo e domínio integral derivado do banco", () => {
  assert.match(supremacy, /COUNT\(\*\)::int AS total/);
  assert.match(supremacy, /FILTER \(WHERE owner_player_id=\$2\)::int AS owned/);
  assert.match(supremacy, /total > 0 && owned === total/);
  assert.doesNotMatch(supremacy, /===\s*42|>=\s*42/);
});

test("policy de objetivo continua reutilizando avaliação existente", () => {
  assert.match(objective, /export async function objectiveVictoryConditionMet/);
});

test("commands usam dispatcher em vez de chamar objectiveWon diretamente", () => {
  for (const path of commandFiles) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /evaluateGameVictory/);
    assert.doesNotMatch(source, /\bobjectiveWon\(/);
  }
});
