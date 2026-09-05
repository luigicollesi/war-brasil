import "server-only";

import { playerGameCommand } from "@/src/lib/game-command";
import { resolveCommandPlayerBySession } from "@/src/lib/game-command-player";
import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import { executeCompleteConquest } from "@/src/lib/game-conquest-command-service";
import { RoomError } from "@/src/lib/rooms";
import {
  readRoomCommandPatch,
  readTerritoryCommandPatches,
} from "./game-command-sync-read-model";

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

export async function completeConquestPatchCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
  metadata?: GameCommandRequestMetadata | null,
) {
  const roomId = normalizeRoomId(value);
  const troops = positiveInteger(input.troops, "Quantidade de tropas inválida.");
  let affectedTerritoryIds: number[] = [];

  return playerGameCommand(
    roomId,
    session,
    metadata,
    "conquest.complete",
    { troops },
    async (client) => {
      const player = await resolveCommandPlayerBySession(client, roomId, session);
      const pending = (
        await client.query<{
          pending_from_territory_id: number | null;
          pending_to_territory_id: number | null;
        }>(
          `SELECT pending_from_territory_id,pending_to_territory_id
           FROM game_rooms
           WHERE id=$1`,
          [roomId],
        )
      ).rows[0];
      affectedTerritoryIds = [
        pending?.pending_from_territory_id,
        pending?.pending_to_territory_id,
      ].filter((id): id is number => typeof id === "number");
      return executeCompleteConquest(client, roomId, player, troops);
    },
    {
      syncEffects: async (client) => ({
        publicPatch: {
          room: await readRoomCommandPatch(client, roomId),
          territories: await readTerritoryCommandPatches(
            client,
            roomId,
            affectedTerritoryIds,
          ),
        },
      }),
    },
  );
}
