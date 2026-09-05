import "server-only";

import { playerGameCommand } from "@/src/lib/game-command";
import {
  resolveCommandPlayerBySession,
} from "@/src/lib/game-command-player";
import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import { executePhaseAction } from "@/src/lib/game-command-service";
import { RoomError } from "@/src/lib/rooms";
import {
  readPlayerHandPrivatePatch,
  readRoomCommandPatch,
  readTerritoryMovementPatches,
} from "./game-command-sync-read-model";

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

export async function phasePatchCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
  metadata?: GameCommandRequestMetadata | null,
) {
  const roomId = normalizeRoomId(value);
  let actorPlayerId: string | null = null;
  let roundBefore: number | null = null;

  return playerGameCommand(
    roomId,
    session,
    metadata,
    "phase",
    input,
    async (client) => {
      const player = await resolveCommandPlayerBySession(client, roomId, session);
      actorPlayerId = player.id;
      roundBefore =
        (
          await client.query<{ round_number: number }>(
            "SELECT round_number FROM game_rooms WHERE id=$1",
            [roomId],
          )
        ).rows[0]?.round_number ?? null;
      return executePhaseAction(client, roomId, player, input);
    },
    {
      syncEffects: async (client) => {
        const playerId = actorPlayerId;
        if (!playerId) return {};

        if (input.action === "finishTrade" || input.action === "finishCards") {
          return {};
        }

        const room = await readRoomCommandPatch(client, roomId);

        if (input.action === "finishAttack") {
          return {
            publicPatch: {
              room,
              territories: await readTerritoryMovementPatches(
                client,
                roomId,
                playerId,
              ),
            },
          };
        }

        if (input.action === "endTurn") {
          if (roundBefore !== null && room.roundNumber !== roundBefore) {
            return {};
          }
          return {
            publicPatch: {
              room,
              territories: await readTerritoryMovementPatches(client, roomId),
            },
            privatePatches: [
              {
                playerId,
                patch: await readPlayerHandPrivatePatch(client, roomId, playerId),
              },
            ],
          };
        }

        return {};
      },
    },
  );
}
