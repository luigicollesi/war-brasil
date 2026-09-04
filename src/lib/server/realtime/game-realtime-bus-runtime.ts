import "server-only";

import type { PoolClient } from "pg";
import type { GameRealtimeBusEvent } from "./game-realtime-bus";
import { postgresGameRealtimeBus } from "./postgres-game-realtime-bus";

export async function publishGameRealtimeBusEvent(
  client: PoolClient,
  event: GameRealtimeBusEvent,
) {
  await postgresGameRealtimeBus.publish(event, {
    postgresClient: client,
  });
}
