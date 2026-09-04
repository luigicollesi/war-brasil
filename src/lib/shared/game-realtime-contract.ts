export const GAME_PROTOCOL_VERSION = 1 as const;
export const GAME_REALTIME_SUBPROTOCOL =
  `war-brasil.v${GAME_PROTOCOL_VERSION}` as const;

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

export type GameRealtimeReadyEvent = GameRealtimeEnvelope<
  "realtime.ready",
  { revision: number }
>;

export type GameRealtimePongEvent = GameRealtimeEnvelope<
  "realtime.pong",
  { clientTime: number; nonce: string }
>;

export type GameRealtimeEvent =
  | GameInvalidatedEvent
  | GameRealtimeReadyEvent
  | GameRealtimePongEvent;

export type GameRealtimePingMessage = {
  protocolVersion: typeof GAME_PROTOCOL_VERSION;
  type: "realtime.ping";
  roomId: string;
  clientTime: number;
  nonce: string;
};

export type GameRealtimeClientMessage = GameRealtimePingMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validRevision(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function validEnvelope(value: unknown) {
  if (!isRecord(value)) return null;
  if (
    value.protocolVersion !== GAME_PROTOCOL_VERSION ||
    typeof value.type !== "string" ||
    typeof value.roomId !== "string" ||
    value.roomId.length < 1 ||
    typeof value.serverTime !== "number" ||
    !Number.isFinite(value.serverTime) ||
    !isRecord(value.payload)
  ) {
    return null;
  }
  return value;
}

export function isGameRealtimeEvent(value: unknown): value is GameRealtimeEvent {
  const envelope = validEnvelope(value);
  if (!envelope) return false;

  if (envelope.type === "game.invalidate" || envelope.type === "realtime.ready") {
    return validRevision(envelope.payload.revision);
  }

  if (envelope.type === "realtime.pong") {
    return (
      typeof envelope.payload.clientTime === "number" &&
      Number.isFinite(envelope.payload.clientTime) &&
      typeof envelope.payload.nonce === "string" &&
      envelope.payload.nonce.length >= 1 &&
      envelope.payload.nonce.length <= 64
    );
  }

  return false;
}

export function isGameRealtimeClientMessage(
  value: unknown,
): value is GameRealtimeClientMessage {
  if (!isRecord(value)) return false;
  return (
    value.protocolVersion === GAME_PROTOCOL_VERSION &&
    value.type === "realtime.ping" &&
    typeof value.roomId === "string" &&
    value.roomId.length >= 1 &&
    typeof value.clientTime === "number" &&
    Number.isFinite(value.clientTime) &&
    typeof value.nonce === "string" &&
    value.nonce.length >= 1 &&
    value.nonce.length <= 64
  );
}
