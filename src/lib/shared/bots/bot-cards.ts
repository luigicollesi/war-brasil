import { isValidTrade, tradeValue } from "../game-rules";
import type { BotAction } from "./bot-action";
import type { BotObjectivePlan, ObjectiveProgress } from "./bot-objective-plan";
import type { BotStrategicCard, BotStrategicState } from "./bot-state";
import type { TerritoryStrategicValue } from "./bot-territory-value";
import { BOT_STRATEGY } from "./bot-strategy-config";

type TradeCandidate = {
  cards: [BotStrategicCard, BotStrategicCard, BotStrategicCard];
  score: number;
};

function validSymbols(cards: readonly BotStrategicCard[]) {
  const symbols = cards.map((card) => (card.isWild ? "wild" : card.symbol));
  if (symbols.some((symbol) => symbol === null)) return false;
  return isValidTrade(symbols as Array<"leaf" | "gold" | "water" | "wild">);
}

function candidateScore(
  state: BotStrategicState,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
  values: ReadonlyMap<number, TerritoryStrategicValue>,
  cards: [BotStrategicCard, BotStrategicCard, BotStrategicCard],
) {
  let score = tradeValue(state.bot.cardTradeCount) * 2;
  const owned = new Map(
    state.territories
      .filter((territory) => territory.ownerPlayerId === state.bot.id)
      .map((territory) => [territory.territoryId, territory]),
  );

  for (const card of cards) {
    if (card.isWild) {
      score -= BOT_STRATEGY.cards.wildcardOpportunityCost;
      continue;
    }
    if (card.territoryId === null) continue;
    const territory = owned.get(card.territoryId);
    if (!territory) continue;

    score += 2 + (values.get(card.territoryId)?.total ?? 0) * 0.8;

    if (
      plan.kind === "fortification" &&
      territory.troops < plan.minimumTroops &&
      territory.troops + 2 >= plan.minimumTroops
    ) {
      score += progress.immediateWinPossible ? 60 : 30;
    }

    if (progress.protectedTerritories.includes(card.territoryId)) score += 8;
  }

  return score;
}

export function enumerateTradeCandidates(
  state: BotStrategicState,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
  values: ReadonlyMap<number, TerritoryStrategicValue>,
) {
  const candidates: TradeCandidate[] = [];
  for (let first = 0; first < state.cards.length - 2; first += 1) {
    for (let second = first + 1; second < state.cards.length - 1; second += 1) {
      for (let third = second + 1; third < state.cards.length; third += 1) {
        const cards = [
          state.cards[first],
          state.cards[second],
          state.cards[third],
        ] as [BotStrategicCard, BotStrategicCard, BotStrategicCard];
        if (!validSymbols(cards)) continue;
        candidates.push({
          cards,
          score: candidateScore(state, plan, progress, values, cards),
        });
      }
    }
  }

  return candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const leftIds = left.cards.map((card) => Number(card.id)).join(":");
    const rightIds = right.cards.map((card) => Number(card.id)).join(":");
    return leftIds.localeCompare(rightIds, undefined, { numeric: true });
  });
}

export function chooseCardTrade(
  state: BotStrategicState,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
  values: ReadonlyMap<number, TerritoryStrategicValue>,
): BotAction | null {
  if (state.cards.length < 3) return null;
  const candidates = enumerateTradeCandidates(state, plan, progress, values);
  const best = candidates[0];
  if (!best) return null;

  const mandatory = state.cards.length >= 5;
  if (!mandatory && best.score < BOT_STRATEGY.cards.optionalTradeThreshold) {
    return null;
  }

  return {
    type: "trade_cards",
    cardIds: best.cards.map((card) => card.id),
  };
}
