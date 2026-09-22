import "server-only";

import type { PoolClient } from "pg";
import type { GameRealtimeBusEvent } from "./game-realtime-bus";
import { publishCloudflareGameRealtimeEvent } from "./cloudflare-game-realtime-bus";
import { postgresGameRealtimeBus } from "./postgres-game-realtime-bus";

export type GameRealtimeDeliveryMode = "postgres" | "cloudflare" | "dual";

export function gameRealtimeDeliveryMode(
  value = process.env.GAME_REALTIME_DELIVERY_MODE,
): GameRealtimeDeliveryMode {
  if (value === "cloudflare" || value === "dual") return value;
  return "postgres";
}

export async function publishGameRealtimeBusEvent(
  client: PoolClient,
  event: GameRealtimeBusEvent,
) {
  const mode = gameRealtimeDeliveryMode();

  if (mode === "postgres") {
    await postgresGameRealtimeBus.publish(event, {
      postgresClient: client,
    });
    return;
  }

  if (mode === "cloudflare") {
    await publishCloudflareGameRealtimeEvent(event);
    return;
  }

  await Promise.all([
    postgresGameRealtimeBus.publish(event, {
      postgresClient: client,
    }),
    publishCloudflareGameRealtimeEvent(event),
  ]);
}
