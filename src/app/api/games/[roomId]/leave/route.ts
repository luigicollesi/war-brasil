import { clearActiveParticipationCookie } from "@/src/lib/server/auth/active-participation-cookie";
import { gameCommandValueResponse } from "@/src/lib/server/game-command-response";
import { createGameCommandRoute } from "@/src/lib/server/game-command-route";
import { leaveGameCommand } from "@/src/lib/server/game-player-exit-service";

export const POST = createGameCommandRoute({
  operation: "leave_game",
  missingSessionMessage: "Entre em uma partida antes de sair.",
  async execute({ roomId, session, accountUserId, metadata }) {
    const result = await leaveGameCommand(
      roomId,
      session,
      metadata,
      accountUserId,
    );
    return clearActiveParticipationCookie(
      gameCommandValueResponse(result),
    );
  },
});
