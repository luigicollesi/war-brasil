import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

test("user notification realtime uses a dedicated authenticated websocket channel", async () => {
  const server = await source("realtime/server.mjs");
  const registry = await source("realtime/user-registry.mjs");
  const tickets = await source("realtime/ticket.mjs");
  const ticketRoute = await source("src/app/api/profile/realtime-ticket/route.ts");
  const clientRuntime = await source(
    "src/components/notifications/user-notification-runtime.tsx",
  );

  assert.match(server, /\/user-realtime/);
  assert.match(server, /verifyUserRealtimeTicket/);
  assert.match(server, /UserRealtimeRegistry/);
  assert.match(server, /\/internal\/user-notification/);
  assert.match(registry, /user\.notifications\.changed/);
  assert.match(tickets, /verifyUserRealtimeTicket/);
  assert.match(tickets, /value\.kind === "user"/);
  assert.match(ticketRoute, /getAuthenticatedSession\(request\)/);
  assert.match(ticketRoute, /issueUserRealtimeTicket\(session\.user\.id\)/);
  assert.match(ticketRoute, /GAME_REALTIME_ENABLED !== "true"/);
  assert.match(ticketRoute, /\{ enabled: false \}/);
  assert.match(clientRuntime, /gameRealtimeMode\(\) === "off"/);
  assert.match(clientRuntime, /body\.enabled === false/);
  assert.match(clientRuntime, /if \(!ticket\)[\s\S]*setRealtimeConnected\(false\)/);
  assert.match(clientRuntime, /realtimeConnected \? 60_000 : 15_000/);
});

test("invitation changes publish only user invalidations after persistence", async () => {
  const service = await source(
    "src/lib/server/game-invitations/invitation-service.ts",
  );
  const publisher = await source(
    "src/lib/server/realtime/user-notification-publisher.ts",
  );

  assert.match(service, /publishUserNotificationChange\(target\.user_id\)/);
  assert.match(
    service,
    /await client\.query\("COMMIT"\);[\s\S]*publishUserNotificationChange\(invitation\.inviter_user_id\)/,
  );
  assert.match(publisher, /\/internal\/user-notification/);
  assert.match(publisher, /JSON\.stringify\(\{ userId \}\)/);
});
