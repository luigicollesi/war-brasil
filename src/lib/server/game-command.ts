import "server-only";

import type { PoolClient } from "pg";
import { pool } from "./db/pool";
import {
  bumpGameRevision,
  type GameCommandResult,
  type GameRevision,
} from "./game-revision";
import { RoomError } from "@/src/lib/rooms";

type GameConditionalCommandResult<T> = {
  value: T | null;
  revision: GameRevision;
  changed: boolean;
};

async function lockRoomRevision(client: PoolClient, roomId: string) {
  const lockedRoom = await client.query<{ id: string; revision: number }>(
    "SELECT id,revision FROM game_rooms WHERE id=$1 FOR UPDATE",
    [roomId],
  );

  const room = lockedRoom.rows[0];
  if (!room) {
    throw new RoomError("Partida não encontrada.", 404);
  }

  return room.revision;
}

export async function gameCommand<T>(
  roomId: string,
  execute: (client: PoolClient) => Promise<T>,
): Promise<GameCommandResult<T>> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const baseRevision = await lockRoomRevision(client, roomId);

    const value = await execute(client);
    const revision = await bumpGameRevision(client, roomId);

    await client.query("COMMIT");

    return { value, baseRevision, revision };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function gameConditionalCommand<T>(
  roomId: string,
  expectedRevision: GameRevision,
  execute: (
    client: PoolClient,
  ) => Promise<{ value: T; changed: boolean }>,
): Promise<GameConditionalCommandResult<T>> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const currentRevision = await lockRoomRevision(client, roomId);

    if (currentRevision !== expectedRevision) {
      await client.query("COMMIT");
      return {
        value: null,
        revision: currentRevision,
        changed: false,
      };
    }

    const result = await execute(client);
    const revision = result.changed
      ? await bumpGameRevision(client, roomId)
      : currentRevision;

    await client.query("COMMIT");

    return {
      value: result.value,
      revision,
      changed: result.changed,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
