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

test("phase 4 starts with a transport-independent realtime bus contract", () => {
  assert.match(bus, /interface GameRealtimeBus/);
  assert.match(bus, /GameRealtimeBusEvent/);
  assert.match(bus, /scope: "room"/);
  assert.match(bus, /scope: "player"/);
  assert.match(bus, /kind: "patch"/);
  assert.match(bus, /postgresClient: PoolClient/);
});

test("postgres remains the only active bus before redis rollout", () => {
  assert.match(runtime, /postgresGameRealtimeBus\.publish/);
  assert.doesNotMatch(runtime, /redis/i);
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
