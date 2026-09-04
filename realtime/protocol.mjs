export const GAME_PROTOCOL_VERSION = 1;
export const GAME_REALTIME_SUBPROTOCOL = `war-brasil.v${GAME_PROTOCOL_VERSION}`;
export const DEFAULT_GAME_REALTIME_CHANNEL = "war_game_revision";
export const GAME_REALTIME_PATH = "/realtime";
export const GAME_REALTIME_MAX_PAYLOAD_BYTES = 16 * 1024;

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
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.roomId !== "string" ||
      !/^\d+$/.test(parsed.roomId) ||
      !Number.isSafeInteger(parsed.revision) ||
      parsed.revision < 1
    ) {
      return null;
    }
    return { roomId: parsed.roomId, revision: parsed.revision };
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
