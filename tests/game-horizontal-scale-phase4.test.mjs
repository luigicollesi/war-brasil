import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bus = readFileSync(
  "src/lib/server/realtime/game-realtime-bus.ts",
  "utf8",
);
const runtime = readFileSync(
  "src/lib/server/realtime/game-realtime-bus-runtime.ts",
  "utf8",
);
const postgres = readFileSync(
  "src/lib/server/realtime/postgres-game-realtime-bus.ts",
  "utf8",
);
const publisher = readFileSync(
  "src/lib/server/game-realtime-publisher.ts",
  "utf8",
);
const worker = readFileSync("worker/server.mjs", "utf8");
const migration = readFileSync(
  "src/lib/db/migrations/020-automation-worker-claims.sql",
  "utf8",
);
const automationSchedule = readFileSync(
  "src/lib/server/automation/game-automation-schedule.ts",
  "utf8",
);
const prepareDevDb = readFileSync("scripts/prepare-dev-db.mjs", "utf8");
const gateway = readFileSync("realtime/server.mjs", "utf8");
const redisSubscriber = readFileSync("realtime/redis-room-subscriber.mjs", "utf8");
const ticketIssuer = readFileSync(
  "src/lib/server/realtime/game-realtime-ticket.ts",
  "utf8",
);
const websocketTransport = readFileSync(
  "src/lib/client/transport/websocket-game-realtime-transport.ts",
  "utf8",
);
const ephemeral = readFileSync(
  "src/lib/client/transport/game-ephemeral-transport.ts",
  "utf8",
);
const ephemeralFactory = readFileSync(
  "src/lib/client/transport/create-game-ephemeral-transport.ts",
  "utf8",
);

test("phase 4 starts with a transport-independent realtime bus contract", () => {
  assert.match(bus, /interface GameRealtimeBus/);
  assert.match(bus, /GameRealtimeBusEvent/);
  assert.match(bus, /scope: "room"/);
  assert.match(bus, /scope: "player"/);
  assert.match(bus, /kind: "patch"/);
  assert.match(bus, /postgresClient: PoolClient/);
});

test("postgres remains the authoritative publication source during redis relay rollout", () => {
  assert.match(runtime, /postgresGameRealtimeBus\.publish/);
  assert.match(postgres, /SELECT pg_notify\(\$1,\$2\)/);
  assert.match(postgres, /JSON\.stringify\(event\)/);
  assert.match(postgres, /war_game_revision/);
});

test("game publisher no longer owns postgres notification details", () => {
  assert.match(publisher, /publishGameRealtimeBusEvent/);
  assert.doesNotMatch(publisher, /SELECT pg_notify/);
  assert.doesNotMatch(publisher, /GAME_REALTIME_CHANNEL/);
  assert.match(publisher, /GAME_REALTIME_NOTIFY_MAX_BYTES/);
  assert.match(publisher, /notify\.failure/);
});

test("automation claims are durable operational metadata, not game revisions", () => {
  assert.match(migration, /automation_claimed_by TEXT/);
  assert.match(migration, /automation_claimed_until TIMESTAMPTZ/);
  assert.match(migration, /game_rooms_automation_claim_idx/);
  assert.match(prepareDevDb, /020-automation-worker-claims\.sql/);
  assert.match(worker, /CLAIM_DUE_AUTOMATION_SQL/);
  assert.match(worker, /RELEASE_AUTOMATION_CLAIM_SQL/);
  assert.match(worker, /runWithConcurrency/);
  assert.match(worker, /claim\.recovered/);
  assert.doesNotMatch(migration, /revision/);
});

test("rescheduling invalidates an old worker lease only when the canonical schedule changes", () => {
  assert.match(
    automationSchedule,
    /SET automation_due_at=\$2,[\s\S]*automation_kind=\$3,[\s\S]*automation_claimed_by=NULL,[\s\S]*automation_claimed_until=NULL/,
  );
  assert.match(
    automationSchedule,
    /WHERE id=\$1[\s\S]*automation_due_at IS DISTINCT FROM \$2::timestamptz[\s\S]*automation_kind IS DISTINCT FROM \$3::varchar/,
  );
});

test("redis gateway subscriptions are scoped to rooms with local sockets", () => {
  assert.match(gateway, /GAME_REALTIME_EVENT_SOURCE/);
  assert.match(gateway, /acquireRoomSource\(identity\.roomId\)/);
  assert.match(gateway, /releaseRoomSource\(context\.roomId\)/);
  assert.match(redisSubscriber, /war:game:\$\{roomId\}:v1/);
  assert.match(redisSubscriber, /existing\.count \+= 1/);
  assert.match(redisSubscriber, /entry\.count -= 1/);
});

test("short-lived realtime tickets never include the long-lived player session", () => {
  assert.match(ticketIssuer, /createHmac\("sha256"/);
  assert.match(ticketIssuer, /DEFAULT_TICKET_TTL_SECONDS = 45/);
  assert.match(ticketIssuer, /roomId/);
  assert.match(ticketIssuer, /playerId/);
  assert.match(ticketIssuer, /nonce: randomUUID\(\)/);
  assert.doesNotMatch(ticketIssuer, /player_session.*payload/);
  assert.match(gateway, /GAME_REALTIME_AUTH_MODE/);
  assert.match(gateway, /verifyRealtimeTicket/);
  assert.match(gateway, /readRealtimeIdentityByPlayer/);
  assert.match(websocketTransport, /fetchRealtimeTicket/);
  assert.match(websocketTransport, /url\.searchParams\.set\("ticket", ticket\)/);
});

test("ephemeral transport is isolated and disabled by default", () => {
  assert.match(ephemeral, /interface GameEphemeralTransport/);
  assert.match(ephemeral, /send\(event: GameEphemeralEvent\)/);
  assert.match(ephemeralFactory, /NullGameEphemeralTransport/);
  assert.doesNotMatch(ephemeral, /GameRealtimeEvent|GameCommandPatch|revision/);
});
