import { phaseCommand } from "@/src/lib/server/game-command-service";
import { gameCommandPatchResponse } from "@/src/lib/server/game-command-response";
import { createGameJsonCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameJsonCommandRoute({
  operation: "advance_phase",
  async execute({ roomId, session, accountUserId, body, metadata }) {
    const result = await phaseCommand(roomId, session, body, metadata, accountUserId);
    return gameCommandPatchResponse(result);
  },
});
