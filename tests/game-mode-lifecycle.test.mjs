import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

const finishService = source("src/lib/server/game-finish-command-service.ts");
const diceService = source("src/lib/server/game-dice-balance-service.ts");

function between(value, start, end) {
  const startIndex = value.indexOf(start);
  assert.ok(startIndex >= 0, `${start} não encontrado`);
  const endIndex = value.indexOf(end, startIndex + start.length);
  assert.ok(endIndex > startIndex, `${end} não encontrado após ${start}`);
  return value.slice(startIndex, endIndex);
}

test("reset para waiting preserva configuração persistente da sala", () => {
  const reset = between(
    finishService,
    "async function resetRoomToWaiting",
    "export async function voteRematchCommand",
  );

  assert.match(reset, /SET status='waiting'/);
  assert.doesNotMatch(reset, /ruleset\s*=/);
  assert.doesNotMatch(reset, /balanced_dice_enabled\s*=/);
});

test("rematch encerra match anterior e cria novo snapshot a partir da sala preservada", () => {
  const reset = between(
    finishService,
    "async function resetRoomToWaiting",
    "export async function voteRematchCommand",
  );
  const rematch = between(
    finishService,
    "export async function voteRematchCommand",
    "export async function returnEveryoneToLobbyCommand",
  );

  assert.match(reset, /finishDiceBalanceMatchForRoom\(client, roomId\)/);
  const resetIndex = rematch.indexOf("await resetRoomToWaiting(client, room.id)");
  const startIndex = rematch.indexOf("await startGame(client, room.id)");
  assert.ok(resetIndex >= 0);
  assert.ok(startIndex > resetIndex);

  assert.match(
    diceService,
    /ruleset_snapshot,balanced_dice_enabled_snapshot/,
  );
  assert.match(diceService, /room\.ruleset/);
  assert.match(diceService, /room\.balanced_dice_enabled/);
});

test("retorno ao lobby preserva settings e não inicia nova partida automaticamente", () => {
  const returnLobby = finishService.slice(
    finishService.indexOf("export async function returnEveryoneToLobbyCommand"),
  );

  assert.match(returnLobby, /await resetRoomToWaiting\(client, room\.id\)/);
  assert.doesNotMatch(returnLobby, /await startGame\(/);
});
