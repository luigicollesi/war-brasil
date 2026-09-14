import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  RedisPresenceStore,
  lastSeenThrottleKey,
  presenceKey,
} from "../presence-store.mjs";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function fakeRedisClient({ ready = true, values = new Map() } = {}) {
  const calls = { connect: 0, set: [], mGet: [], destroy: 0 };
  const client = {
    isReady: ready,
    isOpen: true,
    on() {
      return client;
    },
    async connect() {
      calls.connect += 1;
    },
    async set(key, value, options) {
      calls.set.push({ key, value, options });
      if (options?.NX && values.has(key)) return null;
      values.set(key, value);
      return "OK";
    },
    async mGet(keys) {
      calls.mGet.push([...keys]);
      return keys.map((key) => values.get(key) ?? null);
    },
    destroy() {
      calls.destroy += 1;
      client.isOpen = false;
      client.isReady = false;
    },
  };
  return { client, calls, values };
}

test("presence usa chaves versionadas e rejeita identidade inválida", () => {
  assert.equal(
    presenceKey(USER_A),
    `war:profile:presence:v1:${USER_A}`,
  );
  assert.equal(
    lastSeenThrottleKey(USER_A),
    `war:profile:last-seen-write:v1:${USER_A}`,
  );
  assert.throws(() => presenceKey("other-user"), /userId de presença inválido/);
  assert.throws(
    () => lastSeenThrottleKey("other-user"),
    /userId de presença inválido/,
  );
});

test("heartbeat renova presença e concede lease durável no máximo uma vez por janela", async () => {
  const fake = fakeRedisClient();
  const store = new RedisPresenceStore({
    url: "redis://example.invalid",
    ttlSeconds: 90,
    lastSeenThrottleSeconds: 60,
    createRedisClient: () => fake.client,
    now: () => new Date("2026-09-14T03:30:00.000Z"),
  });

  store.start();
  await new Promise((resolve) => setImmediate(resolve));
  const first = await store.heartbeat(USER_A);
  const second = await store.heartbeat(USER_A);

  assert.equal(first.availability, "available");
  assert.equal(first.state, "online");
  assert.equal(first.persistLastSeen, true);
  assert.equal(second.state, "online");
  assert.equal(second.persistLastSeen, false);
  assert.equal(fake.calls.set.length, 4);
  assert.deepEqual(fake.calls.set[0], {
    key: presenceKey(USER_A),
    value: "2026-09-14T03:30:00.000Z",
    options: { EX: 90 },
  });
  assert.deepEqual(fake.calls.set[1], {
    key: lastSeenThrottleKey(USER_A),
    value: "2026-09-14T03:30:00.000Z",
    options: { EX: 60, NX: true },
  });
  assert.equal(fake.calls.set[2].key, presenceKey(USER_A));
  assert.equal(fake.calls.set[3].key, lastSeenThrottleKey(USER_A));
});

test("roster usa um único MGET e diferencia online de offline", async () => {
  const fake = fakeRedisClient({
    values: new Map([
      [presenceKey(USER_A), "2026-09-14T03:30:00.000Z"],
    ]),
  });
  const store = new RedisPresenceStore({
    url: "redis://example.invalid",
    createRedisClient: () => fake.client,
  });

  store.start();
  await new Promise((resolve) => setImmediate(resolve));
  const result = await store.readMany([USER_A, USER_B, USER_A]);

  assert.equal(result.availability, "available");
  assert.equal(fake.calls.mGet.length, 1);
  assert.deepEqual(fake.calls.mGet[0], [presenceKey(USER_A), presenceKey(USER_B)]);
  assert.deepEqual(result.presences, [
    {
      userId: USER_A,
      state: "online",
      lastSeenAt: "2026-09-14T03:30:00.000Z",
    },
    { userId: USER_B, state: "offline", lastSeenAt: null },
  ]);
});

test("Redis não pronto resulta em unavailable, nunca falso offline", async () => {
  const fake = fakeRedisClient({ ready: false });
  const store = new RedisPresenceStore({
    url: "redis://example.invalid",
    createRedisClient: () => fake.client,
  });
  store.start();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(await store.heartbeat(USER_A), {
    availability: "unavailable",
    state: "unavailable",
  });
  assert.deepEqual(await store.readMany([USER_A]), {
    availability: "unavailable",
    presences: [],
  });
  assert.equal(fake.calls.set.length, 0);
  assert.equal(fake.calls.mGet.length, 0);
});

test("presence store não usa PostgreSQL como heartbeat storage", () => {
  const source = readFileSync("presence-store.mjs", "utf8");
  assert.doesNotMatch(source, /\bpg\b|Pool|UPDATE|INSERT|DELETE/i);
  assert.match(source, /client\.set/);
  assert.match(source, /client\.mGet/);
  assert.match(source, /NX:\s*true/);
});
