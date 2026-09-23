import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const helperPath = "src/lib/server/game-command-route.ts";
const migratedRoutes = [
  ["src/app/api/games/[roomId]/reinforce/route.ts", "reinforceCommand"],
  ["src/app/api/games/[roomId]/maneuver/route.ts", "maneuverCommand"],
  ["src/app/api/games/[roomId]/conquest/route.ts", "completeConquestCommand"],
  ["src/app/api/games/[roomId]/phase/route.ts", "phaseCommand"],
  ["src/app/api/games/[roomId]/cards/trade/route.ts", "tradeCardsCommand"],
];

test("game command route helper centraliza apenas o envelope HTTP repetido", () => {
  assert.equal(existsSync(helperPath), true);
  const helper = readFileSync(helperPath, "utf8");

  assert.match(helper, /^import "server-only";/m);
  assert.match(helper, /getPlayerSession\(request\)/);
  assert.match(helper, /assertAuthenticatedPlayerSeat\(request, session, \{ roomId \}\)/);
  assert.match(helper, /readGameCommandRequestMetadata\(request\)/);
  assert.match(helper, /readJsonObject\(request\)/);
  assert.match(helper, /roomErrorResponse\(error,/);

  const sessionIndex = helper.indexOf("getPlayerSession(request)");
  const seatIndex = helper.indexOf("assertAuthenticatedPlayerSeat");
  const metadataIndex = helper.indexOf("readGameCommandRequestMetadata(request)");
  const bodyIndex = helper.indexOf("readJsonObject(request)");
  const executeIndex = helper.indexOf("execute({");

  assert.ok(sessionIndex >= 0);
  assert.ok(seatIndex > sessionIndex);
  assert.ok(metadataIndex > seatIndex);
  assert.ok(bodyIndex > metadataIndex);
  assert.ok(executeIndex > bodyIndex);
});

test("rotas JSON homogêneas delegam somente o envelope sem esconder o comando", () => {
  for (const [path, commandName] of migratedRoutes) {
    const source = readFileSync(path, "utf8");

    assert.match(source, /createGameJsonCommandRoute/);
    assert.match(source, new RegExp(commandName));
    assert.match(source, /GAME_REVISION_HEADER/);

    assert.doesNotMatch(source, /getPlayerSession\(request\)/);
    assert.doesNotMatch(source, /assertAuthenticatedPlayerSeat\(/);
    assert.doesNotMatch(source, /readGameCommandRequestMetadata\(request\)/);
    assert.doesNotMatch(source, /readJsonObject\(request\)/);
    assert.doesNotMatch(source, /roomErrorResponse\(error,/);
  }
});
