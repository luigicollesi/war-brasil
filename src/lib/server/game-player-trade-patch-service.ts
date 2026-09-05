import "server-only";

import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import { RoomError } from "@/src/lib/rooms";
import { playerGameCommand } from "./game-command";
import { resolveCommandPlayerBySession } from "./game-command-player";
import { executePlayerTradeAction } from "./game-player-trade-service";
import { buildTradeCommandSyncEffects } from "./game-trade-read-model";

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

export async function playerTradePatchCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
  metadata?: GameCommandRequestMetadata | null,
) {
  const roomId = normalizeRoomId(value);

  return playerGameCommand(
    roomId,
    session,
    metadata,
    "player_trade",
    input,
    async (client) => {
      const player = await resolveCommandPlayerBySession(client, roomId, session);
      return executePlayerTradeAction(client, roomId, player.id, input);
    },
    {
      syncEffects: (client) => buildTradeCommandSyncEffects(client, roomId, input),
    },
  );
}
