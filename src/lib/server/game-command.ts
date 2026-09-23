import "server-only";

import type { PoolClient } from "pg";
import {
  isGameCommandPatch,
  type GameCommandPatch,
} from "@/src/lib/game-command-patch";
import type { GamePrivatePatch } from "@/src/lib/game-private-patch";
import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import { RoomError } from "@/src/lib/rooms";
import { enqueueGameAutomationSchedule } from "./automation/game-automation-queue";
import { reconcileGameAutomationSchedule } from "./automation/game-automation-schedule";
import { databasePoolStats, pool } from "./db/pool";
import {
  clearCommandPlayerCache,
  primeCommandPlayer,
} from "./game-command-player";
import {
  prepareGameCommandReceipt,
  saveGameCommandReceipt,
  type GameCommandReceiptRequest,
} from "./game-command-receipt";
import {
  bumpGameRevision,
  type GameCommandResult,
  type GameRevision,
} from "./game-revision";
import {
  publishCommittedGameChange,
  publishCommittedGameInvalidation,
  publishCommittedPlayerGamePatch,
} from "./game-realtime-publisher";
import { runPostResponseTask } from "./cloudflare/post-response-task";
import { publishGameCommandMetric } from "./observability/game-command-metrics";
import { startGameOperationMetric } from "./observability/game-operation-metrics";

type GameConditionalCommandResult<T> = {
  value: T | null;
  revision: GameRevision;
  changed: boolean;
};

type GamePrivatePatchDelivery = {
  playerId: string;
  patch: GamePrivatePatch;
};

type GameCommandSyncEffects = {
  publicPatch?: GameCommandPatch | null;
  privatePatches?: GamePrivatePatchDelivery[];
};

type GameCommandActor = {
  session: string;
  accountUserId?: string;
};

type GameCommandOptions<T> = {
  actor?: GameCommandActor;
  realtimePatch?: (value: T) => GameCommandPatch | null | undefined;
  syncEffects?: (
    client: PoolClient,
    value: T,
  ) => Promise<GameCommandSyncEffects> | GameCommandSyncEffects;
  request?: GameCommandReceiptRequest;
};

async function lockRoomRevision(client: PoolClient, roomId: string) {
  const lockedRoom = await client.query<{ id: string; revision: number }>(
    "SELECT id,revision FROM game.rooms WHERE id=$1 FOR UPDATE",
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

export async function playerGameCommand<T>(
  roomId: string,
  session: string,
  metadata: GameCommandRequestMetadata | null | undefined,
  commandName: string,
  payload: unknown,
  execute: (client: PoolClient) => Promise<T>,
  options: Omit<GameCommandOptions<T>, "request" | "actor"> & {
    accountUserId?: string;
  } = {},
) {
  const { accountUserId, ...commandOptions } = options;
  return gameCommand(roomId, execute, {
    ...commandOptions,
    actor: { session, accountUserId },
    request: metadata
      ? {
          ...metadata,
          session,
          ...(accountUserId ? { accountUserId } : {}),
          commandName,
          payload,
        }
      : undefined,
  });
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
    if (options.actor) {
      await primeCommandPlayer(
        client,
        roomId,
        options.actor.session,
        options.actor.accountUserId,
      );
    }
    const preparedReceipt = options.request
      ? await prepareGameCommandReceipt(client, roomId, options.request)
      : null;

    if (preparedReceipt?.replay) {
      if (preparedReceipt.replay.revision > baseRevision) {
        throw new RoomError("Receipt de comando inconsistente com a partida.", 500, {
          roomId,
          commandId: options.request?.commandId,
          receiptRevision: preparedReceipt.replay.revision,
          currentRevision: baseRevision,
        });
      }

      await client.query("COMMIT");
      transactionOpen = false;
      outcome = "success";

      await runPostResponseTask("game.replay.realtime", () =>
        publishCommittedGameInvalidation(roomId, baseRevision),
      );
      return preparedReceipt.replay as GameCommandResult<T>;
    }

    if (
      options.request &&
      options.request.expectedRevision !== baseRevision
    ) {
      publishGameCommandMetric({
        name: "revision.stale",
        roomId,
        commandName: options.request.commandName,
        expectedRevision: options.request.expectedRevision,
        revision: baseRevision,
      });
      throw new RoomError(
        "A partida avançou antes deste comando. O estado será atualizado.",
        409,
        {
          commandId: options.request.commandId,
          commandName: options.request.commandName,
          expectedRevision: options.request.expectedRevision,
          currentRevision: baseRevision,
        },
      );
    }

    const value = await execute(client);
    const defaultPublicPatch = isGameCommandPatch(value) ? value : null;
    const automationSchedule = await reconcileGameAutomationSchedule(
      client,
      roomId,
    );

    const syncEffects = options.syncEffects
      ? await options.syncEffects(client, value)
      : null;
    const publicPatch =
      syncEffects?.publicPatch ??
      (options.realtimePatch
        ? options.realtimePatch(value) ?? null
        : defaultPublicPatch);
    const privatePatches = syncEffects?.privatePatches ?? [];

    const revision = await bumpGameRevision(client, roomId);
    const requesterPrivatePatch = preparedReceipt
      ? privatePatches.find(
          (delivery) => delivery.playerId === preparedReceipt.playerId,
        )?.patch
      : undefined;
    const result: GameCommandResult<T> = {
      value,
      baseRevision,
      revision,
      ...(publicPatch ? { patch: publicPatch } : {}),
      ...(requesterPrivatePatch
        ? { privatePatch: requesterPrivatePatch }
        : {}),
    };

    if (options.request && preparedReceipt) {
      await saveGameCommandReceipt(
        client,
        roomId,
        options.request,
        preparedReceipt,
        result,
      );
    }

    await client.query("COMMIT");
    transactionOpen = false;
    outcome = "success";

    await runPostResponseTask("game.automation.queue", async () => {
      await enqueueGameAutomationSchedule({
        roomId,
        revision,
        schedule: automationSchedule,
      });
    });

    await runPostResponseTask("game.command.realtime", async () => {
      await publishCommittedGameChange({
        roomId,
        baseRevision,
        revision,
        patch: publicPatch,
      });
      for (const delivery of privatePatches) {
        await publishCommittedPlayerGamePatch({
          roomId,
          playerId: delivery.playerId,
          baseRevision,
          revision,
          patch: delivery.patch,
        });
      }
    });

    return result;
  } catch (error) {
    await rollbackIfNeeded(client, transactionOpen);
    throw error;
  } finally {
    clearCommandPlayerCache(client);
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
      const automationSchedule = await reconcileGameAutomationSchedule(
        client,
        roomId,
      );
      await client.query("COMMIT");
      transactionOpen = false;
      outcome = "success";

      await runPostResponseTask("game.automation.queue", async () => {
        await enqueueGameAutomationSchedule({
          roomId,
          revision: currentRevision,
          schedule: automationSchedule,
        });
      });

      return {
        value: null,
        revision: currentRevision,
        changed: false,
      };
    }

    const result = await execute(client);
    const automationSchedule = await reconcileGameAutomationSchedule(
      client,
      roomId,
    );
    const revision = result.changed
      ? await bumpGameRevision(client, roomId)
      : currentRevision;

    await client.query("COMMIT");
    transactionOpen = false;
    outcome = "success";

    await runPostResponseTask("game.automation.queue", async () => {
      await enqueueGameAutomationSchedule({
        roomId,
        revision,
        schedule: automationSchedule,
      });
    });

    if (result.changed) {
      await runPostResponseTask("game.conditional.realtime", () =>
        publishCommittedGameInvalidation(roomId, revision),
      );
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
