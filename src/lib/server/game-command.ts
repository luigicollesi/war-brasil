import "server-only";

import type { PoolClient } from "pg";
import type { GameCommandPatch } from "@/src/lib/game-command-patch";
import { RoomError } from "@/src/lib/rooms";
import { reconcileGameAutomationSchedule } from "./automation/game-automation-schedule";
import { databasePoolStats, pool } from "./db/pool";
import {
  bumpGameRevision,
  type GameCommandResult,
  type GameRevision,
} from "./game-revision";
import {
  publishGameChange,
  publishGameInvalidation,
} from "./game-realtime-publisher";
import { startGameOperationMetric } from "./observability/game-operation-metrics";

type GameConditionalCommandResult<T> = {
  value: T | null;
  revision: GameRevision;
  changed: boolean;
};

type GameCommandOptions<T> = {
  realtimePatch?: (value: T) => GameCommandPatch | null | undefined;
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

async function rollbackIfNeeded(client: PoolClient, transactionOpen: boolean) {
  if (!transactionOpen) return;
  await client.query("ROLLBACK");
}

export async function gameCommand<T>(
  roomId: string,
  execute: (client: PoolClient) => Promise<T>,
  options: GameCommandOptions<T> = {},
): Promise<GameCommandResult<T>> {
  const client = await pool.connect();
  const finishMetric = startGameOperationMetric("game.command");
  let outcome: "success" | "error" = "error";
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const baseRevision = await lockRoomRevision(client, roomId);

    const value = await execute(client);
    const realtimePatch = options.realtimePatch?.(value) ?? null;
    await reconcileGameAutomationSchedule(client, roomId);
    const revision = await bumpGameRevision(client, roomId);

    await client.query("COMMIT");
    transactionOpen = false;
    outcome = "success";

    await publishGameChange(client, {
      roomId,
      baseRevision,
      revision,
      patch: realtimePatch,
    });

    return { value, baseRevision, revision };
  } catch (error) {
    await rollbackIfNeeded(client, transactionOpen);
    throw error;
  } finally {
    client.release();
    finishMetric(outcome, databasePoolStats());
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
  const finishMetric = startGameOperationMetric("game.conditional_command");
  let outcome: "success" | "error" = "error";
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const currentRevision = await lockRoomRevision(client, roomId);

    if (currentRevision !== expectedRevision) {
      await reconcileGameAutomationSchedule(client, roomId);
      await client.query("COMMIT");
      transactionOpen = false;
      outcome = "success";
      return {
        value: null,
        revision: currentRevision,
        changed: false,
      };
    }

    const result = await execute(client);
    await reconcileGameAutomationSchedule(client, roomId);
    const revision = result.changed
      ? await bumpGameRevision(client, roomId)
      : currentRevision;

    await client.query("COMMIT");
    transactionOpen = false;
    outcome = "success";

    if (result.changed) {
      await publishGameInvalidation(client, roomId, revision);
    }

    return {
      value: result.value,
      revision,
      changed: result.changed,
    };
  } catch (error) {
    await rollbackIfNeeded(client, transactionOpen);
    throw error;
  } finally {
    client.release();
    finishMetric(outcome, databasePoolStats());
  }
}
