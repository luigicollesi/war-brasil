export const GAME_PROTOCOL_VERSION = 1 as const;

export type GameRealtimeEnvelope<
  TType extends string = string,
  TPayload = unknown,
> = {
  protocolVersion: typeof GAME_PROTOCOL_VERSION;
  type: TType;
  roomId: string;
  serverTime: number;
  payload: TPayload;
};

export type GameInvalidatedEvent = GameRealtimeEnvelope<
  "game.invalidate",
  { revision: number }
>;

export type GameRealtimeEvent = GameInvalidatedEvent;

export function isGameRealtimeEvent(value: unknown): value is GameRealtimeEvent {
  if (typeof value !== "object" || value === null) return false;

  const envelope = value as Record<string, unknown>;
  if (
    envelope.protocolVersion !== GAME_PROTOCOL_VERSION ||
    envelope.type !== "game.invalidate" ||
    typeof envelope.roomId !== "string" ||
    typeof envelope.serverTime !== "number" ||
    !Number.isFinite(envelope.serverTime) ||
    typeof envelope.payload !== "object" ||
    envelope.payload === null
  ) {
    return false;
  }

  const revision = (envelope.payload as Record<string, unknown>).revision;
  return (
    typeof revision === "number" &&
    Number.isSafeInteger(revision) &&
    revision >= 1
  );
}
