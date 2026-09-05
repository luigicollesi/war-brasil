import "server-only";

import { playerGameCommand } from "@/src/lib/game-command";
import {
  executeAttack,
  executeCancelBattle,
  executeRollBattleDice,
} from "@/src/lib/game-combat-command-service";
import { resolveCommandPlayerBySession } from "@/src/lib/game-command-player";
import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import { RoomError } from "@/src/lib/rooms";
import { readRoomCommandPatch } from "./game-command-sync-read-model";

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

function positiveInteger(value: unknown, message: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new RoomError(message, 422);
  }
  return value;
}

function roomSyncEffects(roomId: string) {
  return {
    syncEffects: async (client: import("pg").PoolClient) => ({
      publicPatch: {
        room: await readRoomCommandPatch(client, roomId),
      },
    }),
  };
}

export async function attackPatchCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
  metadata?: GameCommandRequestMetadata | null,
) {
  const roomId = normalizeRoomId(value);
  const normalizedInput = {
    fromTerritoryId: positiveInteger(
      input.fromTerritoryId,
      "Território atacante inválido.",
    ),
    toTerritoryId: positiveInteger(
      input.toTerritoryId,
      "Território defensor inválido.",
    ),
  };

  return playerGameCommand(
    roomId,
    session,
    metadata,
    "attack.start",
    normalizedInput,
    async (client) => {
      const player = await resolveCommandPlayerBySession(client, roomId, session);
      return executeAttack(client, roomId, player, normalizedInput);
    },
    roomSyncEffects(roomId),
  );
}

export async function cancelBattlePatchCommand(
  value: string,
  session: string,
  metadata?: GameCommandRequestMetadata | null,
) {
  const roomId = normalizeRoomId(value);
  return playerGameCommand(
    roomId,
    session,
    metadata,
    "attack.cancel",
    null,
    async (client) => {
      const player = await resolveCommandPlayerBySession(client, roomId, session);
      return executeCancelBattle(client, roomId, player);
    },
    roomSyncEffects(roomId),
  );
}

export async function rollBattleDicePatchCommand(
  value: string,
  session: string,
  metadata?: GameCommandRequestMetadata | null,
) {
  const roomId = normalizeRoomId(value);
  return playerGameCommand(
    roomId,
    session,
    metadata,
    "attack.roll",
    null,
    async (client) => {
      const player = await resolveCommandPlayerBySession(client, roomId, session);
      return executeRollBattleDice(client, roomId, player);
    },
    roomSyncEffects(roomId),
  );
}
