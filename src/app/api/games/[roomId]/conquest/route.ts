import { completeConquestCommand } from "@/src/lib/server/game-conquest-command-service";
import { gameCommandPatchResponse } from "@/src/lib/server/game-command-response";
import { createGameJsonCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameJsonCommandRoute({
  operation: "complete_conquest",
  async execute({ roomId, session, body, metadata }) {
    const result = await completeConquestCommand(
      roomId,
      session,
      body,
      metadata,
    );
    return gameCommandPatchResponse(result);
  },
});
