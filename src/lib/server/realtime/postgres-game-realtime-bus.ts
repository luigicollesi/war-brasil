import "server-only";

import type {
  GameRealtimeBus,
  GameRealtimeBusEvent,
  GameRealtimeBusPublishContext,
} from "./game-realtime-bus";

export const DEFAULT_GAME_REALTIME_CHANNEL = "war_game_revision";

export function gameRealtimeChannel() {
  const configured = process.env.GAME_REALTIME_CHANNEL?.trim();
  return configured || DEFAULT_GAME_REALTIME_CHANNEL;
}

export class PostgresGameRealtimeBus implements GameRealtimeBus {
  async publish(
    event: GameRealtimeBusEvent,
    context: GameRealtimeBusPublishContext,
  ) {
    await context.postgresClient.query("SELECT pg_notify($1,$2)", [
      gameRealtimeChannel(),
      JSON.stringify(event),
    ]);
  }
}

export const postgresGameRealtimeBus = new PostgresGameRealtimeBus();
