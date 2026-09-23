import { noStoreJson } from "@/src/lib/api-response";
import { returnEveryoneToLobbyCommand } from "@/src/lib/game-finish-command-service";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
import { createGameCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameCommandRoute({
  operation: "return_everyone_to_lobby",
  missingSessionMessage: "Entre em uma sala antes de voltar ao lobby.",
  async execute({ roomId, session, accountUserId, metadata }) {
    const result = await returnEveryoneToLobbyCommand(roomId, session, metadata, accountUserId);

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
