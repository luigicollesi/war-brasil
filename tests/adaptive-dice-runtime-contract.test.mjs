import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("primeira partida e rematch usam o mesmo startGame", () => {
  const rooms = source("src/lib/server/rooms.ts");
  const finish = source("src/lib/server/game-finish-command-service.ts");

  assert.match(rooms, /import \{ startGame \} from "@\/src\/lib\/server\/start-game-service"/);
  assert.match(rooms, /await startGame\(client, room\.id\)/);
  assert.doesNotMatch(rooms, /async function initializeGame/);

  assert.match(finish, /await startGame\(client, room\.id\)/);
  assert.doesNotMatch(finish, /initializeFreshGame/);
});

test("rematch, lobby e vitória encerram o match ativo", () => {
  const finish = source("src/lib/server/game-finish-command-service.ts");
  const objective = source("src/lib/server/game-objective-service.ts");

  assert.match(finish, /await finishDiceBalanceMatchForRoom\(client, roomId\)/);
  assert.match(objective, /await finishDiceBalanceMatchForRoom\(client, roomId\)/);
});

test("combate usa exclusivamente o serviço adaptativo para atacante e defensor", () => {
  const combat = source("src/lib/server/game-combat-command-service.ts");

  assert.match(combat, /import \{ rollCombatDice \} from "@\/src\/lib\/server\/dice-roll-service"/);
  assert.doesNotMatch(combat, /from "node:crypto"/);
  assert.doesNotMatch(combat, /randomInt\(1,\s*7\)/);
  assert.equal((combat.match(/await rollCombatDice\(/g) ?? []).length, 2);
});

test("serviço de rolagem usa snapshot ativo e locka state por match", () => {
  const service = source("src/lib/server/dice-roll-service.ts");
  const lifecycle = source("src/lib/server/game-dice-balance-service.ts");

  assert.match(service, /FOR UPDATE OF state/);
  assert.match(service, /state\.match_id = \$1/);
  assert.match(service, /state\.player_id = \$2/);
  assert.match(service, /batch_count = \$4/);
  assert.doesNotMatch(service, /Math\.random/);

  assert.match(lifecycle, /match\.finished_at IS NULL/);
  assert.match(lifecycle, /status,current_match_id[\s\S]*FOR UPDATE/);
  assert.match(lifecycle, /room\.status !== "waiting"/);
});

test("feature adaptativa mantém migration base e reparo explícito posterior ao dev 028", () => {
  const names = readdirSync("src/lib/db/migrations/managed")
    .filter((name) => /adaptive|dice/i.test(name))
    .sort();

  assert.deepEqual(names, [
    "029-adaptive-combat-dice.sql",
    "030-repair-adaptive-dice-state-schema.sql",
  ]);
});
