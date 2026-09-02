export type BotAction =
  | { type: "roll_order" }
  | { type: "finish_cards" }
  | { type: "trade_cards"; cardIds: string[] }
  | { type: "reinforce"; territoryId: number; troops: number }
  | {
      type: "attack";
      fromTerritoryId: number;
      toTerritoryId: number;
    }
  | { type: "finish_attack" }
  | { type: "roll_battle" }
  | { type: "complete_conquest"; troops: number }
  | {
      type: "maneuver";
      fromTerritoryId: number;
      toTerritoryId: number;
      troops: number;
    }
  | { type: "end_turn" };

export type BotActionType = BotAction["type"];
