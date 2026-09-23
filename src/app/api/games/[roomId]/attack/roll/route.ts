import { noStoreJson } from "@/src/lib/api-response";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
import { rollBattleDiceCommand } from "@/src/lib/server/game-combat-command-service";
import { createGameCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameCommandRoute({
  operation: "roll_battle_dice",
  async execute({ roomId, session, metadata }) {
    const result = await rollBattleDiceCommand(roomId, session, metadata);

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
