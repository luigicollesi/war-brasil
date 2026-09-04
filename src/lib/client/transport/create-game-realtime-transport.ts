"use client";

import type { GameRealtimeMode } from "./game-realtime-mode";
import type { GameRealtimeTransport } from "./game-realtime-transport";
import { NullGameRealtimeTransport } from "./null-game-realtime-transport";
import { WebSocketGameRealtimeTransport } from "./websocket-game-realtime-transport";

function realtimeAuthMode() {
  return process.env.NEXT_PUBLIC_GAME_REALTIME_AUTH_MODE === "ticket"
    ? "ticket"
    : "cookie";
}

export function createGameRealtimeTransport(
  mode: GameRealtimeMode,
): GameRealtimeTransport {
  if (mode === "off") return new NullGameRealtimeTransport();
  return new WebSocketGameRealtimeTransport({
    url: process.env.NEXT_PUBLIC_GAME_REALTIME_URL,
    authMode: realtimeAuthMode(),
  });
}
