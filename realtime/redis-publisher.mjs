import { createClient } from "@redis/client";
import { recordRealtimeMetric } from "./metrics.mjs";
import { redisRoomChannel } from "./redis-room-subscriber.mjs";

export class RedisRealtimePublisher {
  constructor({ url }) {
    this.url = url;
    this.client = null;
  }

  async start() {
    if (!this.url) throw new Error("GAME_REALTIME_REDIS_URL é obrigatória para publicar no Redis.");
    const client = createClient({ url: this.url });
    this.client = client;
    client.on("error", (error) => {
      recordRealtimeMetric("redisPublishErrors", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    await client.connect();
  }

  async publish(event) {
    const client = this.client;
    if (!client?.isReady) {
      throw new Error("Redis realtime publisher não está pronto.");
    }
    const delivered = await client.publish(
      redisRoomChannel(event.roomId),
      JSON.stringify(event),
    );
    recordRealtimeMetric("redisPublished", {
      roomId: event.roomId,
      revision: event.revision,
      delivered,
    });
    return delivered;
  }

  async stop() {
    const client = this.client;
    this.client = null;
    if (client?.isOpen) client.destroy();
  }
}
