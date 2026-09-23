import { rollBattleDiceCommand } from "@/src/lib/server/game-combat-command-service";
import { gameCommandValueResponse } from "@/src/lib/server/game-command-response";
import { createGameCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameCommandRoute({
  operation: "roll_battle_dice",
  async execute({ roomId, session, metadata }) {
    const result = await rollBattleDiceCommand(roomId, session, metadata);
    return gameCommandValueResponse(result);
  },
});
