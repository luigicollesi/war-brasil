import type { BotActionType } from "./bot-action";

export type BotScheduleRoom = {
  status: "waiting" | "order_roll" | "playing" | "finished";
  phase: string;
  pendingFromTerritoryId: number | null;
  pendingToTerritoryId: number | null;
  battleStage: string | null;
};

export function scheduledBotActionType(
  room: BotScheduleRoom,
): BotActionType | null {
  if (room.status === "order_roll") return "roll_order";
  if (room.status !== "playing") return null;

  if (
    room.battleStage === "awaiting_attacker_roll" ||
    room.battleStage === "awaiting_defender_roll"
  ) {
    return "roll_battle";
  }

  if (
    room.pendingFromTerritoryId !== null &&
    room.pendingToTerritoryId !== null
  ) {
    return "complete_conquest";
  }

  if (room.phase === "cards") return "finish_cards";
  if (room.phase === "reinforcement") return "reinforce";
  if (room.phase === "attack") return "attack";
  if (room.phase === "maneuver") return "maneuver";
  return null;
}
