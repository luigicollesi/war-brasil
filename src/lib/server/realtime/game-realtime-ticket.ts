import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { pool } from "../db/pool";
import { RoomError } from "@/src/lib/rooms";
import { GAME_PROTOCOL_VERSION } from "@/src/lib/game-realtime-contract";

const DEFAULT_TICKET_TTL_SECONDS = 45;
const MIN_TICKET_SECRET_LENGTH = 32;

type RealtimeTicketPayload = {
  v: typeof GAME_PROTOCOL_VERSION;
  roomId: string;
  playerId: string;
  exp: number;
  nonce: string;
};

function ticketSecret() {
  const secret = process.env.GAME_REALTIME_TICKET_SECRET?.trim();
  if (!secret || secret.length < MIN_TICKET_SECRET_LENGTH) {
    throw new RoomError("Tickets realtime não estão configurados.", 503);
  }
  return secret;
}

function ticketTtlSeconds() {
  const parsed = Number(process.env.GAME_REALTIME_TICKET_TTL_SECONDS);
  return Number.isSafeInteger(parsed) && parsed >= 15 && parsed <= 120
    ? parsed
    : DEFAULT_TICKET_TTL_SECONDS;
}

function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export async function issueGameRealtimeTicket(roomId: string, session: string) {
  if (!/^\d+$/.test(roomId)) {
    throw new RoomError("Partida inválida para realtime.", 422);
  }

  const result = await pool.query<{ player_id: string }>(
    `SELECT rp.id::text player_id
     FROM game_rooms room
     JOIN room_players rp
       ON rp.room_id=room.id
      AND rp.player_session=$2
     WHERE room.id=$1`,
    [roomId, session],
  );
  const playerId = result.rows[0]?.player_id;
  if (!playerId) {
    throw new RoomError("Jogador sem acesso a esta partida.", 403);
  }

  const ttlSeconds = ticketTtlSeconds();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload: RealtimeTicketPayload = {
    v: GAME_PROTOCOL_VERSION,
    roomId,
    playerId,
    exp: expiresAt,
    nonce: randomUUID(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = sign(encodedPayload, ticketSecret());

  return {
    ticket: `${encodedPayload}.${signature}`,
    expiresAt,
  };
}
