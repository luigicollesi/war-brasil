import { createClient } from "@redis/client";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_TTL_SECONDS = 90;
const MIN_TTL_SECONDS = 30;
const MAX_TTL_SECONDS = 300;
const DEFAULT_LAST_SEEN_THROTTLE_SECONDS = 60;
const MIN_LAST_SEEN_THROTTLE_SECONDS = 30;
const MAX_LAST_SEEN_THROTTLE_SECONDS = 900;
const MAX_BATCH_SIZE = 100;

export function presenceKey(userId) {
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
    throw new Error("userId de presença inválido.");
  }
  return `war:profile:presence:v1:${userId.toLowerCase()}`;
}

export function lastSeenThrottleKey(userId) {
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
    throw new Error("userId de presença inválido.");
  }
  return `war:profile:last-seen-write:v1:${userId.toLowerCase()}`;
}

function boundedTtlSeconds(value) {
  const parsed = Number(value ?? DEFAULT_TTL_SECONDS);
  if (!Number.isInteger(parsed)) return DEFAULT_TTL_SECONDS;
  return Math.max(MIN_TTL_SECONDS, Math.min(MAX_TTL_SECONDS, parsed));
}

function boundedLastSeenThrottleSeconds(value) {
  const parsed = Number(value ?? DEFAULT_LAST_SEEN_THROTTLE_SECONDS);
  if (!Number.isInteger(parsed)) return DEFAULT_LAST_SEEN_THROTTLE_SECONDS;
  return Math.max(
    MIN_LAST_SEEN_THROTTLE_SECONDS,
    Math.min(MAX_LAST_SEEN_THROTTLE_SECONDS, parsed),
  );
}

function uniqueUserIds(userIds) {
  if (!Array.isArray(userIds)) {
    throw new Error("Lista de presença inválida.");
  }
  const unique = [...new Set(userIds)];
  if (unique.length > MAX_BATCH_SIZE) {
    throw new Error("Lote de presença excede o limite permitido.");
  }
  for (const userId of unique) presenceKey(userId);
  return unique;
}

export class RedisPresenceStore {
  constructor({
    url,
    ttlSeconds = DEFAULT_TTL_SECONDS,
    lastSeenThrottleSeconds = DEFAULT_LAST_SEEN_THROTTLE_SECONDS,
    createRedisClient = createClient,
    now = () => new Date(),
  } = {}) {
    this.url = typeof url === "string" && url.trim() ? url.trim() : null;
    this.ttlSeconds = boundedTtlSeconds(ttlSeconds);
    this.lastSeenThrottleSeconds = boundedLastSeenThrottleSeconds(
      lastSeenThrottleSeconds,
    );
    this.createRedisClient = createRedisClient;
    this.now = now;
    this.client = null;
    this.connecting = false;
  }

  start() {
    if (!this.url || this.client || this.connecting) return;

    this.connecting = true;
    const client = this.createRedisClient({ url: this.url });
    this.client = client;
    client.on("error", () => undefined);
    client.on("end", () => {
      this.connecting = false;
    });

    void client
      .connect()
      .catch(() => undefined)
      .finally(() => {
        this.connecting = false;
      });
  }

  isAvailable() {
    return this.client?.isReady === true;
  }

  async heartbeat(userId) {
    const client = this.client;
    if (!client?.isReady) {
      return { availability: "unavailable", state: "unavailable" };
    }

    const observedAt = this.now().toISOString();
    try {
      await client.set(presenceKey(userId), observedAt, {
        EX: this.ttlSeconds,
      });
    } catch {
      return { availability: "unavailable", state: "unavailable" };
    }

    let persistLastSeen = false;
    try {
      const lease = await client.set(lastSeenThrottleKey(userId), observedAt, {
        EX: this.lastSeenThrottleSeconds,
        NX: true,
      });
      persistLastSeen = lease === "OK";
    } catch {
      // A falha do throttle não transforma um heartbeat Redis válido em offline.
      // Apenas deixa a persistência durável para uma tentativa futura.
      persistLastSeen = false;
    }

    return {
      availability: "available",
      state: "online",
      observedAt,
      ttlSeconds: this.ttlSeconds,
      persistLastSeen,
    };
  }

  async readMany(userIds) {
    const unique = uniqueUserIds(userIds);
    if (unique.length === 0) {
      return { availability: "available", presences: [] };
    }

    const client = this.client;
    if (!client?.isReady) {
      return { availability: "unavailable", presences: [] };
    }

    try {
      const values = await client.mGet(unique.map(presenceKey));
      return {
        availability: "available",
        presences: unique.map((userId, index) => ({
          userId,
          state: values[index] === null ? "offline" : "online",
          lastSeenAt: values[index] ?? null,
        })),
      };
    } catch {
      return { availability: "unavailable", presences: [] };
    }
  }

  stop() {
    const client = this.client;
    this.client = null;
    this.connecting = false;
    if (client?.isOpen) client.destroy();
  }
}
