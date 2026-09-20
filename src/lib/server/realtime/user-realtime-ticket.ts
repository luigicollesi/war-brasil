import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { GAME_PROTOCOL_VERSION } from "@/src/lib/game-realtime-contract";

const DEFAULT_TICKET_TTL_SECONDS = 45;
const MIN_TICKET_SECRET_LENGTH = 32;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ticketSecret() {
  const secret = process.env.GAME_REALTIME_TICKET_SECRET?.trim();
  if (!secret || secret.length < MIN_TICKET_SECRET_LENGTH) {
    throw new Error("Tickets realtime não estão configurados.");
  }
  return secret;
}

function ttlSeconds() {
  const parsed = Number(process.env.GAME_REALTIME_TICKET_TTL_SECONDS);
  return Number.isSafeInteger(parsed) && parsed >= 15 && parsed <= 120
    ? parsed
    : DEFAULT_TICKET_TTL_SECONDS;
}

export function issueUserRealtimeTicket(userId: string) {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error("Usuário inválido para realtime.");
  }

  const expiresAt = Date.now() + ttlSeconds() * 1000;
  const payload = {
    v: GAME_PROTOCOL_VERSION,
    kind: "user",
    userId,
    exp: expiresAt,
    nonce: randomUUID(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", ticketSecret())
    .update(encodedPayload)
    .digest("base64url");

  return {
    ticket: `${encodedPayload}.${signature}`,
    expiresAt,
  };
}
