import "server-only";

import { advanceBotAutomation } from "@/src/lib/bots/bot-runner";
import { gameConditionalCommand } from "@/src/lib/game-command";
import { advanceGamePresentation } from "@/src/lib/game-presentation-service";
import type { GameRevision } from "@/src/lib/game-revision";
import { RoomError } from "@/src/lib/rooms";
import type { BattlePassActionXpResult } from "@/src/lib/server/progression/battle-pass-match-action-xp-service";

type GameAutomationResult = {
  kind: "presentation" | "none" | "scheduled" | "acted";
};

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

  return gameConditionalCommand<GameAutomationResult>(
    roomId,
    expectedRevision,
    async (client) => {
      const xpResults: BattlePassActionXpResult[] = [];
      const presentationChanged = await advanceGamePresentation(
        client,
        roomId,
        nowMs,
        xpResults,
      );

      if (presentationChanged) {
        const grouped = new Map<
          string,
          NonNullable<BattlePassActionXpResult["event"]>[]
        >();
        for (const result of xpResults) {
          if (!result.event) continue;
          const events = grouped.get(result.playerId) ?? [];
          events.push(result.event);
          grouped.set(result.playerId, events);
        }

        return {
          value: { kind: "presentation" as const },
          changed: true,
          privatePatches: [...grouped.entries()].map(
            ([playerId, events]) => ({
              playerId,
              patch: { battlePassXpEvents: events },
            }),
          ),
        };
      }

      const bot = await advanceBotAutomation(client, roomId, nowMs);
      return { value: { kind: bot.kind }, changed: bot.changed };
    },
  );
}
