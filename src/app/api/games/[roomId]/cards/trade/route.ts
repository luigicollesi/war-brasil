import { noStoreJson } from "@/src/lib/api-response";
import { tradeCardsCommand } from "@/src/lib/server/game-troop-command-service";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
import { createGameJsonCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameJsonCommandRoute({
  operation: "trade_cards",
  async execute({ roomId, session, body, metadata }) {
    const result = await tradeCardsCommand(roomId, session, body, metadata);

    return noStoreJson(
      {
        revision: result.revision,
        baseRevision: result.baseRevision,
        ...(result.patch ? { patch: result.patch } : {}),
        ...(result.privatePatch ? { privatePatch: result.privatePatch } : {}),
      },
      {
        headers: {
          [GAME_REVISION_HEADER]: String(result.revision),
        },
      },
    );
  },
});
