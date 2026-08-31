export type BotAction =
  | { type: "roll_order" }
  | { type: "finish_cards" }
  | { type: "reinforce"; territoryId: number; troops: number }
  | { type: "finish_attack" }
  | { type: "roll_battle" }
  | { type: "complete_conquest"; troops: number }
  | { type: "end_turn" };

export type BotActionType = BotAction["type"];
