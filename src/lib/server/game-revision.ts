import "server-only";

import type { PoolClient } from "pg";
import type { GameCommandPatch } from "@/src/lib/game-command-patch";
import type { GamePrivatePatch } from "@/src/lib/game-private-patch";
import { RoomError } from "@/src/lib/rooms";

export type GameRevision = number;

export type GameCommandResult<T> = {
  value: T;
  baseRevision: GameRevision;
  revision: GameRevision;
  patch?: GameCommandPatch;
  privatePatch?: GamePrivatePatch;
};

export async function readPlayerGameRevision(
  client: PoolClient,
  roomId: string,
  session: string,
): Promise<GameRevision> {
  const result = await client.query<{ revision: number }>(
    `SELECT gr.revision
     FROM game_rooms gr
     JOIN room_players rp
       ON rp.room_id=gr.id
      AND rp.player_session=$2
     WHERE gr.id=$1`,
    [roomId, session],
  );

  const row = result.rows[0];
  if (!row) {
    throw new RoomError("Partida não encontrada ou jogador sem acesso.", 404);
  }

  return row.revision;
}

export async function bumpGameRevision(
  client: PoolClient,
  roomId: string,
): Promise<GameRevision> {
  const result = await client.query<{ revision: number }>(
    "UPDATE game_rooms SET revision=revision+1 WHERE id=$1 RETURNING revision",
    [roomId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return row.revision;
}
