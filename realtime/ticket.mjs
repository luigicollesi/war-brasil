import { createHmac, timingSafeEqual } from "node:crypto";
import { GAME_PROTOCOL_VERSION } from "./protocol.mjs";

const MIN_TICKET_SECRET_LENGTH = 32;
const MAX_TICKET_LENGTH = 2048;

function secretFromEnv(env = process.env) {
  const secret = env.GAME_REALTIME_TICKET_SECRET?.trim();
  return secret && secret.length >= MIN_TICKET_SECRET_LENGTH ? secret : null;
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validPayload(value, roomId, now) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.v === GAME_PROTOCOL_VERSION &&
      typeof value.roomId === "string" &&
      value.roomId === roomId &&
      /^\d+$/.test(value.roomId) &&
      typeof value.playerId === "string" &&
      /^\d+$/.test(value.playerId) &&
      Number.isSafeInteger(value.exp) &&
      value.exp > now &&
      value.exp <= now + 120_000 &&
      typeof value.nonce === "string" &&
      /^[0-9a-f-]{36}$/i.test(value.nonce)
  );
}

export function verifyRealtimeTicket(ticket, roomId, options = {}) {
  const now = options.now ?? Date.now();
  const secret = options.secret ?? secretFromEnv(options.env ?? process.env);
  if (!secret || typeof ticket !== "string" || ticket.length > MAX_TICKET_LENGTH) {
    return null;
  }

  const separator = ticket.indexOf(".");
  if (separator <= 0 || separator !== ticket.lastIndexOf(".")) return null;
  const encodedPayload = ticket.slice(0, separator);
  const signature = ticket.slice(separator + 1);
  if (!encodedPayload || !signature) return null;

  const expected = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  if (!safeEqual(signature, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  return validPayload(payload, roomId, now) ? payload : null;
}

export function realtimeTicketConfigured(env = process.env) {
  return secretFromEnv(env) !== null;
}
