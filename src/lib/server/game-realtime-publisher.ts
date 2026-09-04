import "server-only";

import type { PoolClient } from "pg";
import { publishGameRealtimeMetric } from "./observability/game-realtime-metrics";

export const DEFAULT_GAME_REALTIME_CHANNEL = "war_game_revision";

function gameRealtimeEnabled() {
  return process.env.GAME_REALTIME_ENABLED === "true";
}

function gameRealtimeChannel() {
  const configured = process.env.GAME_REALTIME_CHANNEL?.trim();
  return configured || DEFAULT_GAME_REALTIME_CHANNEL;
}

export async function publishGameInvalidation(
  client: PoolClient,
  roomId: string,
  revision: number,
) {
  if (!gameRealtimeEnabled()) return;

  try {
    await client.query("SELECT pg_notify($1,$2)", [
      gameRealtimeChannel(),
      JSON.stringify({ roomId, revision }),
    ]);
    publishGameRealtimeMetric({
      name: "notify.publish",
      roomId,
      revision,
    });
  } catch (error) {
    publishGameRealtimeMetric({
      name: "notify.failure",
      roomId,
      revision,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
