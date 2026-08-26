import "server-only";

import type { PoolClient } from "pg";
import { RoomError } from "@/src/lib/rooms";

export type GameRevision = number;

export type GameCommandResult<T> = {
  value: T;
  revision: GameRevision;
};

export async function readGameRevision(
  client: PoolClient,
  roomId: string,
): Promise<GameRevision> {
  const result = await client.query<{ revision: number }>(
    "SELECT revision FROM game_rooms WHERE id=$1",
    [roomId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new RoomError("Partida não encontrada.", 404);
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
