import "server-only";

import { pool } from "@/src/lib/db/pool";
import { RoomError } from "@/src/lib/server/room-error";
import { getAuthenticatedSession } from "./auth-guard";

type PlayerSeatScope =
  | { roomCode: string; roomId?: never }
  | { roomId: string; roomCode?: never };

export async function assertAuthenticatedPlayerSeat(
  request: Request,
  playerSession: string,
  scope: PlayerSeatScope,
  options: { allowDeparted?: boolean } = {},
) {
  const accountSession = await getAuthenticatedSession(request);
  if (!accountSession) {
    throw new RoomError("Autenticação necessária para acessar este assento.", 401);
  }

  const result = "roomCode" in scope
    ? await pool.query<{ player_id: string }>(
        `SELECT player.id AS player_id
           FROM game.players player
           JOIN game.rooms room ON room.id = player.room_id
          WHERE room.code = $1
            AND player.player_session = $2
            AND player.user_id = $3
            AND player.is_bot = FALSE
            AND (player.left_at IS NULL OR $4::boolean=TRUE)
          LIMIT 1`,
        [
          scope.roomCode,
          playerSession,
          accountSession.user.id,
          options.allowDeparted === true,
        ],
      )
    : await pool.query<{ player_id: string }>(
        `SELECT player.id AS player_id
           FROM game.players player
          WHERE player.room_id = $1::bigint
            AND player.player_session = $2
            AND player.user_id = $3
            AND player.is_bot = FALSE
            AND (player.left_at IS NULL OR $4::boolean=TRUE)
          LIMIT 1`,
        [
          scope.roomId,
          playerSession,
          accountSession.user.id,
          options.allowDeparted === true,
        ],
      );

  const seat = result.rows[0];
  if (!seat) {
    throw new RoomError("Este assento não pertence à conta autenticada.", 403);
  }

  return {
    accountSession,
    playerId: seat.player_id,
  };
}
