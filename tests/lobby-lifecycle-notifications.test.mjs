import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

test("waiting-room lifecycle removes stale seats only before game start", async () => {
  const rooms = await source("src/lib/server/rooms.ts");
  const heartbeat = await source("src/app/api/rooms/[code]/heartbeat/route.ts");
  const meRoute = await source("src/app/api/rooms/[code]/me/route.ts");

  assert.match(rooms, /heartbeatWaitingRoom/);
  assert.match(rooms, /leaveWaitingRoom/);
  assert.match(rooms, /cleanupStaleWaitingRoomSeats/);
  assert.match(rooms, /room\.status='waiting'/);
  assert.match(rooms, /staleAfterSeconds = 20/);
  assert.match(rooms, /DELETE FROM game\.rooms/);
  assert.match(rooms, /NOT EXISTS|SELECT EXISTS/);
  assert.match(heartbeat, /assertAuthenticatedPlayerSeat/);
  assert.match(meRoute, /export async function DELETE/);
});

test("worker periodically invokes protected waiting-room cleanup", async () => {
  const worker = await source("worker/server.mjs");
  const client = await source("worker/lobby-cleanup-client.mjs");
  const route = await source("src/app/api/internal/lobby/cleanup/route.ts");

  assert.match(worker, /cleanupLobbyIfDue/);
  assert.match(worker, /cleanupStaleLobbies/);
  assert.match(worker, /cleanupIntervalMs/);
  const config = await source("worker/config.mjs");
  assert.match(config, /LOBBY_CLEANUP_INTERVAL_MS, 5_000/);
  assert.match(client, /\/api\/internal\/lobby\/cleanup/);
  assert.match(route, /assertGameAutomationWorkerRequest/);
  assert.match(route, /cleanupStaleWaitingRoomSeats\(20, 100\)/);
  assert.match(route, /publishLobbyChangeByCode/);
  assert.match(route, /changedRoomCodes/);
});

test("global notification runtime recovers offline invites and rejection notifications", async () => {
  const runtime = await source(
    "src/components/notifications/user-notification-runtime.tsx",
  );
  const layout = await source("src/app/layout.tsx");
  const notifications = await source(
    "src/lib/server/profile/notification-repository.ts",
  );

  assert.match(layout, /<UserNotificationRuntime \/>/);
  assert.match(runtime, /\/api\/profile\/game-invitations/);
  assert.match(runtime, /\/api\/profile\/notifications/);
  assert.match(runtime, /new WebSocket/);
  assert.match(runtime, /user\.notifications\.changed/);
  assert.match(runtime, /\/api\/profile\/realtime-ticket/);
  assert.match(runtime, /REALTIME_WATCHDOG_INTERVAL_MS = 5 \* 60_000/);
  assert.match(runtime, /FALLBACK_POLL_INTERVAL_MS = 15_000/);
  assert.match(
    runtime,
    /realtimeConnected[\s\S]*REALTIME_WATCHDOG_INTERVAL_MS[\s\S]*FALLBACK_POLL_INTERVAL_MS/,
  );
  assert.match(runtime, /ENTRAR NA SALA/);
  assert.match(runtime, /RECUSAR/);
  assert.match(runtime, /router\.push\(`\/lobby\//);
  assert.match(runtime, /Não foi possível entrar/);
  assert.match(notifications, /game_invitation_rejected/);
});

test("game browser URL uses public room code while engine keeps internal room id", async () => {
  const page = await source("src/app/game/[roomId]/page.tsx");
  const rooms = await source("src/lib/server/rooms.ts");
  const lobby = await source("src/components/lobby-client.tsx");

  assert.match(page, /resolveGameRoomReference/);
  assert.match(page, /redirect\(`\/game\/\$\{room\.code\}`\)/);
  assert.match(page, /<GameClient roomId=\{room\.id\} \/>/);
  assert.match(rooms, /WHERE code=\$1/);
  assert.match(lobby, /router\.replace\(`\/game\/\$\{snapshot\.room\.code\}`\)/);
});
