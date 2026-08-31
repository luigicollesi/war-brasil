import "server-only";

import { advanceBotAutomation } from "@/src/lib/bots/bot-runner";
import { gameConditionalCommand } from "@/src/lib/game-command";
import { advanceGamePresentation } from "@/src/lib/game-presentation-service";
import type { GameRevision } from "@/src/lib/game-revision";
import { RoomError } from "@/src/lib/rooms";

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

export async function advanceGameAutomationCommand(
  value: string,
  expectedRevision: GameRevision,
  nowMs = Date.now(),
) {
  const roomId = normalizeRoomId(value);

  return gameConditionalCommand(
    roomId,
    expectedRevision,
    async (client) => {
      const presentationChanged = await advanceGamePresentation(
        client,
        roomId,
        nowMs,
      );

      if (presentationChanged) {
        return { value: { kind: "presentation" as const }, changed: true };
      }

      const bot = await advanceBotAutomation(client, roomId, nowMs);
      return { value: { kind: bot.kind }, changed: bot.changed };
    },
  );
}
