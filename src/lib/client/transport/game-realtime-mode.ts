export type GameRealtimeMode = "off" | "shadow" | "hybrid";

export function gameRealtimeMode(
  value = process.env.NEXT_PUBLIC_GAME_REALTIME_MODE,
): GameRealtimeMode {
  if (value === "shadow" || value === "hybrid") return value;
  return "off";
}
