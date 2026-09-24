import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("player commands resolve and lock the authenticated seat once per transaction", () => {
  const boundary = readFileSync("src/lib/server/game-command.ts", "utf8");
  const player = readFileSync("src/lib/server/game-command-player.ts", "utf8");
  const receipt = readFileSync("src/lib/server/game-command-receipt.ts", "utf8");

  assert.match(boundary, /await primeCommandPlayer\(/);
  assert.match(boundary, /accountUserId/);
  assert.match(boundary, /clearCommandPlayerCache\(client\)/);
  assert.match(
    player,
    /AND \(\$3::uuid IS NULL OR user_id=\$3::uuid\)/,
  );
  assert.match(player, /AND is_bot=FALSE/);
  assert.match(player, /allowDepartedSeat = false/);
  assert.match(
    player,
    /AND \(\$4::boolean=TRUE OR left_at IS NULL\)/,
  );
  assert.match(player, /FOR UPDATE/);
  assert.match(player, /commandPlayerCache\.get\(client\)/);

  assert.match(receipt, /resolveCommandPlayerBySession\(/);
  assert.doesNotMatch(receipt, /async function resolveReceiptPlayerId/);
  assert.doesNotMatch(
    receipt,
    /FROM game\.players[\s\S]*FOR UPDATE/,
  );
});


test("HTTP command envelope passes authenticated account identity into the transaction", () => {
  const route = readFileSync("src/lib/server/game-command-route.ts", "utf8");
  const command = readFileSync("src/lib/server/game-command.ts", "utf8");

  assert.match(route, /getAuthenticatedSession\(request\)/);
  assert.match(route, /accountUserId: accountSession\.user\.id/);
  assert.doesNotMatch(route, /assertAuthenticatedPlayerSeat/);
  assert.match(
    command,
    /actor: \{ session, accountUserId, allowDepartedSeat \}/,
  );
  assert.match(command, /primeCommandPlayer\([\s\S]*options\.actor\.accountUserId/);
});


test("leave command alone can replay a receipt after the seat is marked departed", () => {
  const exit = readFileSync(
    "src/lib/server/game-player-exit-service.ts",
    "utf8",
  );
  const leaveRoute = readFileSync(
    "src/app/api/games/[roomId]/leave/route.ts",
    "utf8",
  );
  const receipt = readFileSync(
    "src/lib/server/game-command-receipt.ts",
    "utf8",
  );

  assert.match(exit, /allowDepartedSeat:\s*true/);
  assert.match(
    exit,
    /resolveCommandPlayerBySession\([\s\S]*accountUserId,[\s\S]*true/,
  );
  assert.match(leaveRoute, /accountUserId/);
  assert.doesNotMatch(leaveRoute, /allowDepartedSeat:\s*true/);
  assert.match(receipt, /request\.allowDepartedSeat \?\? false/);
});
