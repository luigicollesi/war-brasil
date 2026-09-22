import "server-only";

import type { GameRealtimeBusEvent } from "./game-realtime-bus";
import { realtimeInternalFetch } from "./realtime-internal-client";

export async function publishCloudflareGameRealtimeEvent(
  event: GameRealtimeBusEvent,
) {
  const response = await realtimeInternalFetch("/internal/game-event", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!response) {
    throw new Error("Entrega realtime Cloudflare não está configurada.");
  }
  if (!response.ok) {
    throw new Error(
      `Worker realtime recusou o evento (${response.status}).`,
    );
  }
}
