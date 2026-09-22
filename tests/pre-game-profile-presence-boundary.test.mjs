import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("browser heartbeat derives target exclusively from authenticated session", () => {
  const route = read("src/app/api/profile/presence/heartbeat/route.ts");

  assert.match(route, /requireProfileMutationActor\(request\)/);
  assert.match(route, /renewOwnPresence\(actor\.userId\)/);
  assert.match(route, /persistCommanderLastSeen\(actor\.userId, presence\.lastSeenAt\)/);
  assert.match(route, /presence\.shouldPersistLastSeen/);
  assert.doesNotMatch(route, /request\.json\(\)/);
  assert.doesNotMatch(route, /searchParams/);
  assert.doesNotMatch(route, /payload/);
});

test("presence outage is a successful degraded heartbeat, not an application 5xx", () => {
  const route = read("src/app/api/profile/presence/heartbeat/route.ts");
  const gateway = read("src/lib/server/profile/presence-gateway.ts");

  assert.match(route, /availability: "unavailable", state: "unavailable"/);
  assert.match(route, /status:\s*200/);
  assert.match(route, /X-Profile-Presence/);
  assert.doesNotMatch(route, /status:\s*503/);
  assert.match(gateway, /PresenceRequestOptions/);
  assert.match(gateway, /boundedTimeout/);
  assert.match(gateway, /options\.timeoutMs/);
});

test("Next presence gateway remains server-only and fails closed as unavailable", () => {
  const gateway = read("src/lib/server/profile/presence-gateway.ts");
  const internal = read(
    "src/lib/server/realtime/realtime-internal-client.ts",
  );

  assert.match(gateway, /import "server-only"/);
  assert.match(gateway, /realtimeInternalFetch/);
  assert.match(gateway, /\/internal\/presence\/heartbeat/);
  assert.match(gateway, /\/internal\/presence\/batch/);
  assert.match(internal, /GAME_REALTIME_INTERNAL_URL/);
  assert.match(internal, /GAME_REALTIME_INTERNAL_TOKEN/);
  assert.match(internal, /Authorization/);
  assert.match(gateway, /shouldPersistLastSeen: payload\.persistLastSeen === true/);
  assert.match(gateway, /return \{ availability: "unavailable", presences: new Map\(\) \}/);
  assert.doesNotMatch(gateway, /@redis\/client/);
});

test("durable last-seen writer is monotonic and separate from Redis heartbeat storage", () => {
  const persistence = read("src/lib/server/profile/presence-persistence.ts");
  const store = read("realtime/presence-store.mjs");

  assert.match(persistence, /UPDATE profile\.commanders/);
  assert.match(persistence, /last_seen_at=GREATEST/);
  assert.match(persistence, /WHERE user_id=\$1::uuid/);
  assert.match(store, /lastSeenThrottleKey/);
  assert.match(store, /NX:\s*true/);
  assert.doesNotMatch(store, /UPDATE profile\.commanders|\bpg\b|Pool/);
});

test("presence endpoints are isolated from game realtime readiness", () => {
  const gateway = read("realtime/server.mjs");

  assert.match(gateway, /presenceAvailable:\s*presenceStore\.isAvailable\(\)/);
  assert.match(gateway, /ready:\s*gatewayReady\(\)/);
  assert.match(gateway, /\/internal\/presence\/heartbeat/);
  assert.match(gateway, /\/internal\/presence\/batch/);

  const heartbeatHandler = gateway.match(
    /async function handleInternalPresenceHeartbeat[\s\S]*?\n}\n\nasync function handleInternalPresenceBatch/,
  )?.[0] ?? "";
  const batchHandler = gateway.match(
    /async function handleInternalPresenceBatch[\s\S]*?\n}\n\nconst server/,
  )?.[0] ?? "";
  assert.ok(heartbeatHandler);
  assert.ok(batchHandler);
  assert.doesNotMatch(heartbeatHandler, /gatewayReady\(/);
  assert.doesNotMatch(batchHandler, /gatewayReady\(/);
  assert.match(heartbeatHandler, /authorizeInternalRequest/);
  assert.match(batchHandler, /authorizeInternalRequest/);
});

test("friend roster applies privacy before one batch presence lookup", () => {
  const social = read("src/lib/server/profile/social-read-service.ts");

  assert.match(
    social,
    /getPresenceStates\([\s\S]*filter\(\(row\) => row\.presence_visibility !== "private"\)[\s\S]*map\(\(row\) => row\.user_id\)/,
  );
  assert.equal((social.match(/getPresenceStates\(/g) ?? []).length, 1);
  assert.match(
    social,
    /if \(row\.presence_visibility === "private"\)[\s\S]*state: "unavailable"/,
  );
});

test("public profile queries Redis only after relationship privacy authorizes presence", () => {
  const service = read("src/lib/server/profile/profile-service.ts");

  assert.match(service, /const presenceVisible = visibilityAllows/);
  assert.match(
    service,
    /presenceVisible\s*\?\s*getPresenceStates\(\[row\.user_id\]\)\s*:\s*Promise\.resolve\(null\)/,
  );
  assert.match(
    service,
    /!presenceVisible[\s\S]*state: "unavailable", lastSeenAt: null/,
  );
});

test("global heartbeat is session-aware, periodic, identity-free and independent from Foundation", () => {
  const heartbeat = read("src/components/profile/profile-presence-heartbeat.tsx");
  const layout = read("src/app/layout.tsx");
  const runtime = read(
    "src/components/pre-game/foundation/pre-game-command-runtime.tsx",
  );

  assert.match(heartbeat, /useSession\(\)/);
  assert.match(heartbeat, /if \(isPending \|\| !session\?\.user\)/);
  assert.match(heartbeat, /HEARTBEAT_INTERVAL_MS = 60_000/);
  assert.match(heartbeat, /document\.visibilityState !== "visible"/);
  assert.match(heartbeat, /fetch\("\/api\/profile\/presence\/heartbeat"/);
  assert.doesNotMatch(heartbeat, /userId/);
  assert.doesNotMatch(heartbeat, /JSON\.stringify/);
  assert.match(layout, /<ProfilePresenceHeartbeat \/>/);
  assert.doesNotMatch(runtime, /ProfilePresenceHeartbeat/);
  assert.match(runtime, /if \(!intent\) return <>\{children\}<\/>;/);
});
