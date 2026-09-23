import { maneuverCommand } from "@/src/lib/game-maneuver-command-service";
import { gameCommandPatchResponse } from "@/src/lib/server/game-command-response";
import { createGameJsonCommandRoute } from "@/src/lib/server/game-command-route";

export const POST = createGameJsonCommandRoute({
  operation: "maneuver",
  async execute({ roomId, session, body, metadata }) {
    const result = await maneuverCommand(roomId, session, body, metadata);
    return gameCommandPatchResponse(result);
  },
});
