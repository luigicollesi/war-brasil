const MIN_TICKET_SECRET_LENGTH = 32;
const MAX_TICKET_LENGTH = 2048;
const MAX_TICKET_FUTURE_MS = 120_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodePayload(encodedPayload) {
  try {
    return JSON.parse(decoder.decode(decodeBase64Url(encodedPayload)));
  } catch {
    return null;
  }
}

async function verifiedPayload(ticket, secret) {
  if (
    typeof secret !== "string" ||
    secret.trim().length < MIN_TICKET_SECRET_LENGTH ||
    typeof ticket !== "string" ||
    ticket.length > MAX_TICKET_LENGTH
  ) {
    return null;
  }

  const separator = ticket.indexOf(".");
  if (separator <= 0 || separator !== ticket.lastIndexOf(".")) return null;

  const encodedPayload = ticket.slice(0, separator);
  const encodedSignature = ticket.slice(separator + 1);
  if (!encodedPayload || !encodedSignature) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret.trim()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(encodedSignature),
      encoder.encode(encodedPayload),
    );
    return valid ? decodePayload(encodedPayload) : null;
  } catch {
    return null;
  }
}

function validExpiry(value, now) {
  return (
    Number.isSafeInteger(value) &&
    value > now &&
    value <= now + MAX_TICKET_FUTURE_MS
  );
}

function validNonce(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

export async function verifyGameRealtimeTicket(
  ticket,
  secret,
  expectedRoomId,
  now = Date.now(),
) {
  const value = await verifiedPayload(ticket, secret);
  if (
    !value ||
    typeof value !== "object" ||
    value.v !== 2 ||
    typeof value.roomId !== "string" ||
    value.roomId !== expectedRoomId ||
    !/^\d+$/.test(value.roomId) ||
    typeof value.playerId !== "string" ||
    !/^\d+$/.test(value.playerId) ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    !validExpiry(value.exp, now) ||
    !validNonce(value.nonce)
  ) {
    return null;
  }

  return value;
}

export async function verifyUserRealtimeTicket(
  ticket,
  secret,
  now = Date.now(),
) {
  const value = await verifiedPayload(ticket, secret);
  if (
    !value ||
    typeof value !== "object" ||
    value.v !== 2 ||
    value.kind !== "user" ||
    typeof value.userId !== "string" ||
    !UUID_PATTERN.test(value.userId) ||
    !validExpiry(value.exp, now) ||
    !validNonce(value.nonce)
  ) {
    return null;
  }

  return value;
}

export function realtimeTicketSecretConfigured(secret) {
  return typeof secret === "string" && secret.trim().length >= MIN_TICKET_SECRET_LENGTH;
}
