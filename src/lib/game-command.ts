import "server-only";

import type { PoolClient } from "pg";
import { pool } from "@/src/lib/db/pool";
import {
  bumpGameRevision,
  type GameCommandResult,
} from "@/src/lib/game-revision";
import { RoomError } from "@/src/lib/rooms";

export async function gameCommand<T>(
  roomId: string,
  execute: (client: PoolClient) => Promise<T>,
): Promise<GameCommandResult<T>> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockedRoom = await client.query<{ id: string }>(
      "SELECT id FROM game_rooms WHERE id=$1 FOR UPDATE",
      [roomId],
    );

    if (!lockedRoom.rows[0]) {
      throw new RoomError("Partida não encontrada.", 404);
    }

    const value = await execute(client);
    const revision = await bumpGameRevision(client, roomId);

    await client.query("COMMIT");

    return { value, revision };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
