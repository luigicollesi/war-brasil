import { attackCommand } from "@/src/lib/server/game-combat-command-service";
import { gameCommandValueResponse } from "@/src/lib/server/game-command-response";
import { createGameJsonCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameJsonCommandRoute({
  operation: "attack",
  async execute({ roomId, session, accountUserId, body, metadata }) {
    const result = await attackCommand(roomId, session, body, metadata, accountUserId);
    return gameCommandValueResponse(result);
  },
});
