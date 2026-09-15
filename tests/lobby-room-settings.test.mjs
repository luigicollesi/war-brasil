import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("lobby contract exposes authoritative game settings and room capability", () => {
  const lobby = source("src/lib/shared/lobby.ts");

  assert.match(lobby, /ruleset:\s*GameRuleset/);
  assert.match(lobby, /balancedDiceEnabled:\s*boolean/);
  assert.match(lobby, /canManageRoom:\s*boolean/);
});

test("room settings use the locked room transaction and reset only human readiness", () => {
  const rooms = source("src/lib/server/rooms.ts");

  assert.match(rooms, /export async function updateRoomSettings/);
  assert.match(rooms, /findRoomForUpdate\(client, code\)/);
  assert.match(rooms, /await assertRoomManager\(client, room\.id, playerSession\)/);
  assert.match(rooms, /SET is_ready = FALSE\s+WHERE room_id = \$1 AND is_bot = FALSE/s);
  assert.match(rooms, /ruleset !== room\.ruleset/);
  assert.match(rooms, /balancedDiceEnabled !== room\.balanced_dice_enabled/);
});

test("settings route authenticates the seat and accepts only room settings payload", () => {
  const route = source("src/app/api/rooms/[code]/settings/route.ts");

  assert.match(route, /assertAuthenticatedPlayerSeat/);
  assert.match(route, /readJsonObject/);
  assert.match(route, /updateRoomSettings/);
  assert.match(route, /operation:\s*"update_room_settings"/);
});
