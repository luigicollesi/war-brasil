import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@redis/client";
import { RedisPresenceStore, presenceKey } from "../presence-store.mjs";

const REDIS_URL = process.env.PROFILE_PRESENCE_TEST_REDIS_URL?.trim() || null;
const USER_A = "33333333-3333-4333-8333-333333333333";

async function waitUntilReady(store) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    if (store.isAvailable()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("presence store não ficou pronto no prazo do teste.");
}

test(
  "Redis real mantém TTL e converte chave expirada em offline",
  { skip: !REDIS_URL },
  async () => {
    const admin = createClient({ url: REDIS_URL });
    const store = new RedisPresenceStore({
      url: REDIS_URL,
      ttlSeconds: 90,
    });

    admin.on("error", () => undefined);
    await admin.connect();
    store.start();

    try {
      await waitUntilReady(store);
      await admin.del(presenceKey(USER_A));

      const heartbeat = await store.heartbeat(USER_A);
      assert.equal(heartbeat.availability, "available");
      assert.equal(heartbeat.state, "online");

      const ttl = await admin.ttl(presenceKey(USER_A));
      assert.ok(ttl > 0 && ttl <= 90, `TTL inesperado: ${ttl}`);

      const online = await store.readMany([USER_A]);
      assert.equal(online.availability, "available");
      assert.equal(online.presences[0]?.state, "online");

      await admin.expire(presenceKey(USER_A), 1);
      await new Promise((resolve) => setTimeout(resolve, 1_150));

      const offline = await store.readMany([USER_A]);
      assert.equal(offline.availability, "available");
      assert.equal(offline.presences[0]?.state, "offline");
      assert.equal(offline.presences[0]?.lastSeenAt, null);
    } finally {
      await admin.del(presenceKey(USER_A)).catch(() => undefined);
      store.stop();
      if (admin.isOpen) admin.destroy();
    }
  },
);
