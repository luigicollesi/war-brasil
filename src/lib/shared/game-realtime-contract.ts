import {
  isGameCommandPatch,
  type GameCommandPatch,
} from "./game-command-patch";
import {
  isGamePrivatePatch,
  type GamePrivatePatch,
} from "./game-private-patch";
import {
  isTradeCardDescriptor,
  type TradeCardDescriptor,
} from "./game-trade-rules";

export const GAME_PROTOCOL_VERSION = 2 as const;
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

export type GamePrivateInvalidatedEvent = GameRealtimeEnvelope<
  "game.private.invalidate",
  { revision: number }
>;

export type GamePatchEvent = GameRealtimeEnvelope<
  "game.patch",
  {
    baseRevision: number;
    revision: number;
    patch: GameCommandPatch;
  }
>;

export type GamePrivatePatchEvent = GameRealtimeEnvelope<
  "game.private.patch",
  {
    baseRevision: number;
    revision: number;
    patch: GamePrivatePatch;
  }
>;

export type GameTradeSignalEvent = GameRealtimeEnvelope<
  "trade.signal",
  {
    playerId: string;
    turnNumber: number;
    card: TradeCardDescriptor;
  }
>;

export type GameTradeResolutionEvent = GameRealtimeEnvelope<
  "trade.resolution",
  {
    offerId: string;
    turnNumber: number;
    recipientPlayerId: string;
    actorPlayerId: string;
    outcome: "declined" | "counter_declined";
  }
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
  | GamePrivateInvalidatedEvent
  | GamePatchEvent
  | GamePrivatePatchEvent
  | GameTradeSignalEvent
  | GameTradeResolutionEvent
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

type ValidatedRealtimeEnvelope = {
  protocolVersion: typeof GAME_PROTOCOL_VERSION;
  type: string;
  roomId: string;
  serverTime: number;
  payload: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validRevision(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function validPlayerId(value: unknown) {
  return typeof value === "string" && /^\d+$/.test(value);
}

function validOfferId(value: unknown) {
  return typeof value === "string" && /^\d+$/.test(value);
}

export function isGameRealtimeEvent(value: unknown): value is GameRealtimeEvent {
  const envelope = validEnvelope(value);
  if (!envelope) return false;

  const payload = envelope.payload;

  if (
    envelope.type === "game.invalidate" ||
    envelope.type === "game.private.invalidate" ||
    envelope.type === "realtime.ready"
  ) {
    return validRevision(payload.revision);
  }

  if (envelope.type === "game.patch") {
    return (
      validRevision(payload.baseRevision) &&
      validRevision(payload.revision) &&
      Number(payload.revision) > Number(payload.baseRevision) &&
      isGameCommandPatch(payload.patch)
    );
  }

  if (envelope.type === "game.private.patch") {
    return (
      validRevision(payload.baseRevision) &&
      validRevision(payload.revision) &&
      Number(payload.revision) > Number(payload.baseRevision) &&
      isGamePrivatePatch(payload.patch)
    );
  }

  if (envelope.type === "trade.signal") {
    return (
      validPlayerId(payload.playerId) &&
      typeof payload.turnNumber === "number" &&
      Number.isSafeInteger(payload.turnNumber) &&
      payload.turnNumber >= 1 &&
      isTradeCardDescriptor(payload.card)
    );
  }

  if (envelope.type === "trade.resolution") {
    return (
      validOfferId(payload.offerId) &&
      typeof payload.turnNumber === "number" &&
      Number.isSafeInteger(payload.turnNumber) &&
      payload.turnNumber >= 1 &&
      validPlayerId(payload.recipientPlayerId) &&
      validPlayerId(payload.actorPlayerId) &&
      (payload.outcome === "declined" || payload.outcome === "counter_declined")
    );
  }

  if (envelope.type === "realtime.pong") {
    return (
      typeof payload.clientTime === "number" &&
      Number.isFinite(payload.clientTime) &&
      typeof payload.nonce === "string" &&
      payload.nonce.length >= 1 &&
      payload.nonce.length <= 64
    );
  }

  return false;
}

function validEnvelope(value: unknown): ValidatedRealtimeEnvelope | null {
  if (!isRecord(value)) return null;

  const payload = value.payload;
  if (
    value.protocolVersion !== GAME_PROTOCOL_VERSION ||
    typeof value.type !== "string" ||
    typeof value.roomId !== "string" ||
    value.roomId.length < 1 ||
    typeof value.serverTime !== "number" ||
    !Number.isFinite(value.serverTime) ||
    !isRecord(payload)
  ) {
    return null;
  }

  return {
    protocolVersion: GAME_PROTOCOL_VERSION,
    type: value.type,
    roomId: value.roomId,
    serverTime: value.serverTime,
    payload,
  };
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
