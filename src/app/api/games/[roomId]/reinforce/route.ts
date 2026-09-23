import { reinforceCommand } from "@/src/lib/game-troop-command-service";
import { gameCommandPatchResponse } from "@/src/lib/server/game-command-response";
import { createGameJsonCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameJsonCommandRoute({
  operation: "reinforce",
  async execute({ roomId, session, accountUserId, body, metadata }) {
    const result = await reinforceCommand(roomId, session, body, metadata, accountUserId);
    return gameCommandPatchResponse(result);
  },
});
