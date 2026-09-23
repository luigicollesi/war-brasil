import { noStoreJson } from "@/src/lib/api-response";
import { voteRematchCommand } from "@/src/lib/game-finish-command-service";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
import { createGameCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameCommandRoute({
  operation: "vote_rematch",
  missingSessionMessage: "Entre em uma sala antes de votar na revanche.",
  async execute({ roomId, session, metadata }) {
    const result = await voteRematchCommand(roomId, session, metadata);

    return noStoreJson(
      {
        ...result.value,
        baseRevision: result.baseRevision,
      },
      {
        headers: {
          [GAME_REVISION_HEADER]: String(result.revision),
        },
      },
    );
  },
});
