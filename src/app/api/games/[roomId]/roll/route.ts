import { noStoreJson } from "@/src/lib/api-response";
import { rollOrderDieCommand } from "@/src/lib/game-command-service";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
import { createGameCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameCommandRoute({
  operation: "roll_order_die",
  missingSessionMessage: "Entre em uma sala antes de rolar o dado.",
  async execute({ roomId, session, accountUserId, metadata }) {
    const result = await rollOrderDieCommand(roomId, session, metadata, accountUserId);

    return noStoreJson(
      { ...result.value, revision: result.revision },
      {
        headers: {
          [GAME_REVISION_HEADER]: String(result.revision),
        },
      },
    );
  },
});
