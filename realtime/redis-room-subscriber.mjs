import { createClient } from "@redis/client";
import { recordRealtimeMetric } from "./metrics.mjs";
import { parseNotificationPayload } from "./protocol.mjs";

export function redisRoomChannel(roomId) {
  if (typeof roomId !== "string" || !/^\d+$/.test(roomId)) {
    throw new Error("roomId inválido para canal Redis realtime.");
  }
  return `war:game:${roomId}:v1`;
}

export class RedisRoomSubscriber {
  constructor({ url, onEvent, onHealthChange }) {
    this.url = url;
    this.onEvent = onEvent;
    this.onHealthChange = onHealthChange;
    this.client = null;
    this.rooms = new Map();
    this.healthy = false;
    this.stopped = true;
  }

  setHealthy(value) {
    if (this.healthy === value) return;
    this.healthy = value;
    this.onHealthChange(value);
  }

  async start() {
    if (!this.url) throw new Error("GAME_REALTIME_REDIS_URL é obrigatória no modo redis.");
    this.stopped = false;
    const client = createClient({ url: this.url });
    this.client = client;

    client.on("ready", () => {
      this.setHealthy(true);
      recordRealtimeMetric("redisReady", {});
    });
    client.on("reconnecting", () => {
      this.setHealthy(false);
      recordRealtimeMetric("redisReconnects", {});
    });
    client.on("end", () => this.setHealthy(false));
    client.on("error", (error) => {
      this.setHealthy(false);
      recordRealtimeMetric("redisErrors", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    await client.connect();
    this.setHealthy(client.isReady);
  }

  async acquireRoom(roomId) {
    const client = this.client;
    if (!client || !client.isReady || this.stopped) {
      throw new Error("Redis realtime subscriber não está pronto.");
    }

    const existing = this.rooms.get(roomId);
    if (existing) {
      existing.count += 1;
      await existing.ready;
      return;
    }

    const channel = redisRoomChannel(roomId);
    const listener = (message) => {
      const event = parseNotificationPayload(message);
      if (!event || event.roomId !== roomId) {
        recordRealtimeMetric("redisProtocolErrors", { roomId });
        return;
      }
      this.onEvent(event);
    };
    const entry = {
      count: 1,
      channel,
      listener,
      ready: null,
    };
    entry.ready = client.subscribe(channel, listener);
    this.rooms.set(roomId, entry);

    try {
      await entry.ready;
      recordRealtimeMetric("redisRoomSubscriptions", { roomId });
    } catch (error) {
      if (this.rooms.get(roomId) === entry) this.rooms.delete(roomId);
      throw error;
    }
  }

  async releaseRoom(roomId) {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count > 0) return;

    this.rooms.delete(roomId);
    await entry.ready.catch(() => undefined);
    const client = this.client;
    if (!client?.isOpen) return;
    await client.unsubscribe(entry.channel, entry.listener).catch(() => undefined);
    recordRealtimeMetric("redisRoomUnsubscriptions", { roomId });
  }

  isHealthy() {
    return this.healthy;
  }

  roomCount() {
    return this.rooms.size;
  }

  async stop() {
    this.stopped = true;
    this.setHealthy(false);
    const client = this.client;
    this.client = null;
    this.rooms.clear();
    if (client?.isOpen) client.destroy();
  }
}
