import { cancelBattleCommand } from "@/src/lib/server/game-combat-command-service";
import { gameCommandValueResponse } from "@/src/lib/server/game-command-response";
import { createGameCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameCommandRoute({
  operation: "cancel_attack",
  async execute({ roomId, session, accountUserId, metadata }) {
    const result = await cancelBattleCommand(roomId, session, metadata, accountUserId);
    return gameCommandValueResponse(result);
  },
});
