import { tradeCardsCommand } from "@/src/lib/server/game-troop-command-service";
import { gameCommandPatchResponse } from "@/src/lib/server/game-command-response";
import { createGameJsonCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameJsonCommandRoute({
  operation: "trade_cards",
  async execute({ roomId, session, body, metadata }) {
    const result = await tradeCardsCommand(roomId, session, body, metadata);
    return gameCommandPatchResponse(result);
  },
});
