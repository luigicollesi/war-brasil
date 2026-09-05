import "server-only";

import { playerGameCommand } from "@/src/lib/game-command";
import { resolveCommandPlayerBySession } from "@/src/lib/game-command-player";
import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import { executeTradeCards } from "@/src/lib/game-troop-command-service";
import { RoomError } from "@/src/lib/rooms";
import {
  readPlayerHandPrivatePatch,
  readRoomCommandPatch,
  readTerritoryCommandPatches,
} from "./game-command-sync-read-model";

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

export async function tradeCardsPatchCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
  metadata?: GameCommandRequestMetadata | null,
) {
  const roomId = normalizeRoomId(value);
  const ids = Array.isArray(input.cardIds)
    ? input.cardIds.filter((card): card is string => typeof card === "string")
    : [];

  if (ids.length !== 3 || new Set(ids).size !== 3) {
    throw new RoomError("Selecione exatamente três cartas diferentes.", 422);
  }

  let playerId: string | null = null;
  let affectedTerritoryIds: number[] = [];

  return playerGameCommand(
    roomId,
    session,
    metadata,
    "cards.trade",
    { cardIds: [...ids].sort() },
    async (client) => {
      const player = await resolveCommandPlayerBySession(client, roomId, session);
      playerId = player.id;
      affectedTerritoryIds = (
        await client.query<{ territory_id: number | null }>(
          `SELECT territory_id
           FROM game_cards
           WHERE room_id=$1
             AND owner_player_id=$2
             AND zone='hand'
             AND id=ANY($3::bigint[])`,
          [roomId, player.id, ids],
        )
      ).rows
        .map((row) => row.territory_id)
        .filter((id): id is number => id !== null);
      return executeTradeCards(client, roomId, player, ids);
    },
    {
      syncEffects: async (client) => {
        const actorId = playerId;
        if (!actorId) return {};
        return {
          publicPatch: {
            room: await readRoomCommandPatch(client, roomId),
            territories: await readTerritoryCommandPatches(
              client,
              roomId,
              affectedTerritoryIds,
            ),
          },
          privatePatches: [
            {
              playerId: actorId,
              patch: await readPlayerHandPrivatePatch(client, roomId, actorId),
            },
          ],
        };
      },
    },
  );
}
