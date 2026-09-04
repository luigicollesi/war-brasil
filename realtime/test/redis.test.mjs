import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { redisRoomChannel } from "../redis-room-subscriber.mjs";

test("redis usa canais versionados e isolados por sala", () => {
  assert.equal(redisRoomChannel("42"), "war:game:42:v1");
  assert.throws(() => redisRoomChannel("42:*"), /roomId inválido/);
  assert.throws(() => redisRoomChannel(""), /roomId inválido/);
});

test("redis subscriber mantém refcount e valida payload antes do broadcast", () => {
  const source = readFileSync("redis-room-subscriber.mjs", "utf8");
  assert.match(source, /existing\.count \+= 1/);
  assert.match(source, /entry\.count -= 1/);
  assert.match(source, /client\.subscribe\(channel, listener\)/);
  assert.match(source, /client\.unsubscribe\(entry\.channel, entry\.listener\)/);
  assert.match(source, /parseNotificationPayload\(message\)/);
  assert.match(source, /event\.roomId !== roomId/);
});

test("redis relay preserva PostgreSQL como origem autoritativa durante rollout", () => {
  const relay = readFileSync("redis-relay.mjs", "utf8");
  const publisher = readFileSync("redis-publisher.mjs", "utf8");
  assert.match(relay, /PostgresRealtimeListener/);
  assert.match(relay, /RedisRealtimePublisher/);
  assert.match(relay, /publisher\.publish\(event\)/);
  assert.match(publisher, /client\.publish/);
  assert.match(publisher, /JSON\.stringify\(event\)/);
  assert.doesNotMatch(publisher, /UPDATE|INSERT|DELETE/i);
});
