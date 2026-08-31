import "server-only";

import type { PoolClient } from "pg";
import { RoomError } from "@/src/lib/rooms";

export type CommandPlayer = {
  id: string;
  turn_position: number | null;
};

export async function resolveCommandPlayerBySession(
  client: PoolClient,
  roomId: string,
  session: string,
): Promise<CommandPlayer> {
  const player = (
    await client.query<CommandPlayer>(
      `SELECT id,turn_position
       FROM room_players
       WHERE room_id=$1 AND player_session=$2
       FOR UPDATE`,
      [roomId, session],
    )
  ).rows[0];

  if (!player) {
    throw new RoomError("Você não pertence a esta partida.", 403);
  }

  return player;
}
