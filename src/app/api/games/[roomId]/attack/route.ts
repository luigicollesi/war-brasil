import { noStoreJson } from "@/src/lib/api-response";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
import { attackCommand } from "@/src/lib/server/game-combat-command-service";
import { createGameJsonCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameJsonCommandRoute({
  operation: "attack",
  async execute({ roomId, session, body, metadata }) {
    const result = await attackCommand(roomId, session, body, metadata);

    return noStoreJson(
      {
        ...result.value,
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
