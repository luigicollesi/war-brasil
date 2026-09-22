import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(path, "utf8");

test("Cloudflare realtime Worker uses hibernating SQLite Durable Objects", () => {
  const config = source("wrangler.realtime.jsonc");
  const worker = source("realtime/cloudflare/worker.mjs");

  assert.match(config, /"main": "realtime\/cloudflare\/worker\.mjs"/);
  assert.match(config, /"GAME_ROOM_REALTIME"/);
  assert.match(config, /"USER_REALTIME"/);
  assert.match(config, /"type": "durable-object"/);
  assert.match(config, /"storage": "sqlite"/);
  assert.match(config, /"GAME_REALTIME_TICKET_SECRET"/);
  assert.match(config, /"GAME_REALTIME_INTERNAL_TOKEN"/);
  assert.doesNotMatch(config, /"new_classes"/);

  assert.match(worker, /extends DurableObject/);
  assert.match(worker, /acceptWebSocket\(server/);
  assert.match(worker, /serializeAttachment/);
  assert.match(worker, /getWebSockets/);
  assert.match(worker, /async webSocketMessage/);
  assert.match(worker, /async webSocketClose/);
  assert.match(worker, /Sec-WebSocket-Protocol/);
  assert.match(worker, /blockConcurrencyWhile/);
  assert.match(worker, /storage\.get\("latestRevision"\)/);
  assert.match(worker, /storage\.put\("latestRevision", event\.revision\)/);
  assert.match(worker, /Math\.max\(revision, this\.latestRevision\)/);
});

test("Cloudflare realtime validates tickets, origins and internal delivery", () => {
  const worker = source("realtime/cloudflare/worker.mjs");
  const ticket = source("realtime/cloudflare/ticket.mjs");

  assert.match(worker, /GAME_REALTIME_ALLOWED_ORIGINS/);
  assert.match(worker, /verifyGameRealtimeTicket/);
  assert.match(worker, /verifyUserRealtimeTicket/);
  assert.match(worker, /\/internal\/game-event/);
  assert.match(worker, /\/internal\/ephemeral/);
  assert.match(worker, /\/internal\/user-notification/);
  assert.match(worker, /\/internal\/presence\/heartbeat/);
  assert.match(worker, /\/internal\/presence\/batch/);
  assert.match(worker, /GAME_REALTIME_INTERNAL_TOKEN/);
  assert.match(ticket, /crypto\.subtle\.verify/);
  assert.match(ticket, /Number\.isSafeInteger\(value\.revision\)/);
  assert.match(ticket, /value\.revision < 1/);
});

test("server realtime delivery can switch from postgres to Cloudflare without changing domain commands", () => {
  const runtime = source(
    "src/lib/server/realtime/game-realtime-bus-runtime.ts",
  );
  const cloudflareBus = source(
    "src/lib/server/realtime/cloudflare-game-realtime-bus.ts",
  );
  const internalClient = source(
    "src/lib/server/realtime/realtime-internal-client.ts",
  );

  assert.match(runtime, /"postgres" \| "cloudflare" \| "dual"/);
  assert.match(runtime, /GAME_REALTIME_DELIVERY_MODE/);
  assert.match(runtime, /return "postgres"/);
  assert.match(runtime, /publishCloudflareGameRealtimeEvent/);
  assert.match(cloudflareBus, /\/internal\/game-event/);
  assert.match(internalClient, /GAME_REALTIME_SERVICE/);
  assert.match(internalClient, /GAME_REALTIME_INTERNAL_URL/);
});

test("Cloudflare game sockets can hibernate instead of waking on periodic browser pings", () => {
  const transport = source(
    "src/lib/client/transport/websocket-game-realtime-transport.ts",
  );

  assert.doesNotMatch(transport, /PING_INTERVAL_MS/);
  assert.doesNotMatch(transport, /setInterval\(\(\) => this\.sendPing/);
  assert.match(transport, /this\.sendPing\(\)/);
  assert.match(transport, /body\.enabled === false/);
  assert.match(transport, /this\.transition\("degraded"\)/);
});

test("game tickets carry revision and trade signals publish only after commit", () => {
  const ticket = source("src/lib/server/realtime/game-realtime-ticket.ts");
  const trade = source("src/lib/server/game-player-trade-service.ts");

  assert.match(ticket, /room\.revision/);
  assert.match(ticket, /revision: number/);
  assert.match(ticket, /revision,/);
  assert.match(
    trade,
    /client\.query\("COMMIT"\);[\s\S]*transactionOpen = false;[\s\S]*publishGameTradeSignal/,
  );
});
