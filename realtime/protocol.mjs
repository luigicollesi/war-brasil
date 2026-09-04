export const GAME_PROTOCOL_VERSION = 1;
export const GAME_REALTIME_SUBPROTOCOL = `war-brasil.v${GAME_PROTOCOL_VERSION}`;
export const DEFAULT_GAME_REALTIME_CHANNEL = "war_game_revision";
export const GAME_REALTIME_PATH = "/realtime";
export const GAME_REALTIME_MAX_PAYLOAD_BYTES = 16 * 1024;

const PATCH_KEYS = new Set(["room", "territories"]);
const ROOM_PATCH_KEYS = new Set([
  "status",
  "phase",
  "reinforcementsRemaining",
  "winnerPlayerId",
]);
const TERRITORY_PATCH_KEYS = new Set([
  "territoryId",
  "troops",
  "movedInTurn",
]);
const GAME_STATUSES = new Set(["waiting", "order_roll", "playing", "finished"]);
const GAME_PHASES = new Set([
  "trade",
  "reinforcement",
  "attack",
  "maneuver",
  "end_turn",
  "finished",
]);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record, allowed) {
  return Object.keys(record).every((key) => allowed.has(key));
}

function validRevision(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

function validPlayerId(value) {
  return typeof value === "string" && /^\d+$/.test(value);
}

function validTradeDescriptor(value) {
  if (!isRecord(value)) return false;
  if (value.kind === "wild") {
    return Object.keys(value).every((key) => key === "kind");
  }
  if (value.kind === "territory") {
    return (
      Object.keys(value).every((key) => key === "kind" || key === "territoryId") &&
      Number.isSafeInteger(value.territoryId) &&
      value.territoryId >= 1 &&
      value.territoryId <= 42
    );
  }
  if (value.kind === "symbol") {
    return (
      Object.keys(value).every((key) => key === "kind" || key === "symbol") &&
      new Set(["leaf", "gold", "water"]).has(value.symbol)
    );
  }
  return false;
}

function validRoomPatch(value) {
  if (!isRecord(value) || !hasOnlyKeys(value, ROOM_PATCH_KEYS)) return false;
  if (value.status !== undefined && !GAME_STATUSES.has(value.status)) return false;
  if (value.phase !== undefined && !GAME_PHASES.has(value.phase)) return false;
  if (
    value.reinforcementsRemaining !== undefined &&
    (!Number.isSafeInteger(value.reinforcementsRemaining) ||
      value.reinforcementsRemaining < 0)
  ) {
    return false;
  }
  if (
    value.winnerPlayerId !== undefined &&
    value.winnerPlayerId !== null &&
    (typeof value.winnerPlayerId !== "string" || value.winnerPlayerId.length < 1)
  ) {
    return false;
  }
  return Object.keys(value).length > 0;
}

function validTerritoryPatch(value) {
  if (!isRecord(value) || !hasOnlyKeys(value, TERRITORY_PATCH_KEYS)) return false;
  if (
    !Number.isSafeInteger(value.territoryId) ||
    value.territoryId < 1 ||
    value.territoryId > 42 ||
    !Number.isSafeInteger(value.troops) ||
    value.troops < 1
  ) {
    return false;
  }
  if (
    value.movedInTurn !== undefined &&
    (!Number.isSafeInteger(value.movedInTurn) || value.movedInTurn < 0)
  ) {
    return false;
  }
  return true;
}

function validPublicPatch(value) {
  if (!isRecord(value) || !hasOnlyKeys(value, PATCH_KEYS)) return false;
  if (value.room === undefined && value.territories === undefined) return false;
  if (value.room !== undefined && !validRoomPatch(value.room)) return false;
  if (value.territories !== undefined) {
    if (!Array.isArray(value.territories) || value.territories.length > 42) {
      return false;
    }
    const ids = new Set();
    for (const territory of value.territories) {
      if (!validTerritoryPatch(territory) || ids.has(territory.territoryId)) {
        return false;
      }
      ids.add(territory.territoryId);
    }
  }
  return true;
}

export function gameRealtimeChannel() {
  const configured = process.env.GAME_REALTIME_CHANNEL?.trim();
  const channel = configured || DEFAULT_GAME_REALTIME_CHANNEL;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(channel)) {
    throw new Error("GAME_REALTIME_CHANNEL inválido.");
  }
  return channel;
}

export function serverEvent(type, roomId, payload) {
  return JSON.stringify({
    protocolVersion: GAME_PROTOCOL_VERSION,
    type,
    roomId,
    serverTime: Date.now(),
    payload,
  });
}

export function parseNotificationPayload(value) {
  try {
    const parsed = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      typeof parsed.roomId !== "string" ||
      !/^\d+$/.test(parsed.roomId)
    ) {
      return null;
    }

    if (parsed.kind === "ephemeral") {
      if (
        parsed.scope !== "room" ||
        typeof parsed.eventId !== "string" ||
        parsed.eventId.length < 1 ||
        parsed.eventId.length > 64 ||
        parsed.eventType !== "trade.signal" ||
        !isRecord(parsed.payload) ||
        !validPlayerId(parsed.payload.playerId) ||
        !Number.isSafeInteger(parsed.payload.turnNumber) ||
        parsed.payload.turnNumber < 1 ||
        !validTradeDescriptor(parsed.payload.card)
      ) {
        return null;
      }

      return {
        kind: "ephemeral",
        scope: "room",
        roomId: parsed.roomId,
        eventId: parsed.eventId,
        eventType: "trade.signal",
        payload: parsed.payload,
      };
    }

    if (!validRevision(parsed.revision)) return null;

    const scope = parsed.scope ?? "room";
    if (scope !== "room" && scope !== "player") return null;

    if (parsed.kind === undefined || parsed.kind === "invalidate") {
      if (scope === "player" && !validPlayerId(parsed.playerId)) return null;
      if (scope === "room" && parsed.playerId !== undefined) return null;

      return {
        kind: "invalidate",
        scope,
        roomId: parsed.roomId,
        revision: parsed.revision,
        ...(scope === "player" ? { playerId: parsed.playerId } : {}),
      };
    }

    if (
      parsed.kind === "patch" &&
      scope === "room" &&
      parsed.playerId === undefined &&
      validRevision(parsed.baseRevision) &&
      parsed.revision > parsed.baseRevision &&
      validPublicPatch(parsed.patch)
    ) {
      return {
        kind: "patch",
        scope: "room",
        roomId: parsed.roomId,
        baseRevision: parsed.baseRevision,
        revision: parsed.revision,
        patch: parsed.patch,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function parseClientMessage(value, expectedRoomId) {
  try {
    const parsed = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.protocolVersion !== GAME_PROTOCOL_VERSION ||
      parsed.type !== "realtime.ping" ||
      parsed.roomId !== expectedRoomId ||
      typeof parsed.clientTime !== "number" ||
      !Number.isFinite(parsed.clientTime) ||
      typeof parsed.nonce !== "string" ||
      parsed.nonce.length < 1 ||
      parsed.nonce.length > 64
    ) {
      return null;
    }
    return {
      type: "realtime.ping",
      roomId: parsed.roomId,
      clientTime: parsed.clientTime,
      nonce: parsed.nonce,
    };
  } catch {
    return null;
  }
}
