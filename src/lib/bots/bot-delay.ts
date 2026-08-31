import { randomInt } from "node:crypto";
import type { BotActionType } from "./bot-action";

type DelayRange = {
  minMs: number;
  maxMs: number;
};

const BOT_DELAY_RANGES: Record<BotActionType, DelayRange> = {
  roll_order: { minMs: 800, maxMs: 1_400 },
  finish_cards: { minMs: 500, maxMs: 900 },
  reinforce: { minMs: 700, maxMs: 1_200 },
  finish_attack: { minMs: 800, maxMs: 1_300 },
  roll_battle: { minMs: 700, maxMs: 1_100 },
  complete_conquest: { minMs: 650, maxMs: 1_000 },
  end_turn: { minMs: 700, maxMs: 1_200 },
};

export function botDelayRange(action: BotActionType): DelayRange {
  return BOT_DELAY_RANGES[action];
}

export function pickBotDelayMs(action: BotActionType) {
  const range = botDelayRange(action);
  return randomInt(range.minMs, range.maxMs + 1);
}
