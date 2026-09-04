import { PostgresRealtimeListener } from "./listener.mjs";
import { recordRealtimeMetric } from "./metrics.mjs";
import { RedisRealtimePublisher } from "./redis-publisher.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não está configurada para o realtime Redis relay.");
}

const redisUrl = process.env.GAME_REALTIME_REDIS_URL?.trim();
if (!redisUrl) {
  throw new Error("GAME_REALTIME_REDIS_URL não está configurada para o realtime Redis relay.");
}

const publisher = new RedisRealtimePublisher({ url: redisUrl });
let listenerHealthy = false;
let stopping = false;
let publishChain = Promise.resolve();

const listener = new PostgresRealtimeListener({
  connectionString,
  onEvent: (event) => {
    publishChain = publishChain
      .then(() => publisher.publish(event))
      .catch((error) => {
        recordRealtimeMetric("redisRelayFailures", {
          roomId: event.roomId,
          revision: event.revision,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  },
  onHealthChange: (healthy) => {
    listenerHealthy = healthy;
    recordRealtimeMetric("redisRelayPostgresHealth", { healthy });
  },
});

await publisher.start();
await listener.start();
recordRealtimeMetric("redisRelayStarted", { listenerHealthy });

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  recordRealtimeMetric("redisRelayStopping", { signal });
  await listener.stop();
  await publishChain.catch(() => undefined);
  await publisher.stop();
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    void shutdown(signal).finally(() => process.exit(0));
  });
}
