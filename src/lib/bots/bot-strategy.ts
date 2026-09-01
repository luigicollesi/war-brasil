import type { BotAction } from "./bot-action";
import { chooseAttack } from "./bot-attack";
import { chooseCardTrade } from "./bot-cards";
import { chooseConquestTransfer } from "./bot-conquest";
import { chooseManeuver } from "./bot-maneuver";
import {
  buildObjectivePlan,
  evaluateObjectiveProgress,
} from "./bot-objective-plan";
import { chooseReinforcement } from "./bot-reinforcement";
import type { BotStrategicState } from "./bot-state";
import { territoryStrategicValues } from "./bot-territory-value";

export type BotStrategyContext = {
  pendingConquest: {
    fromTerritoryId: number;
    toTerritoryId: number;
  } | null;
};

export function chooseStrategicBotAction(
  state: BotStrategicState,
  context: BotStrategyContext = { pendingConquest: null },
): BotAction | null {
  const plan = buildObjectivePlan(state);
  const progress = evaluateObjectiveProgress(state, plan);
  const values = territoryStrategicValues(state, plan, progress);

  if (context.pendingConquest) {
    return chooseConquestTransfer(
      state,
      plan,
      progress,
      values,
      context.pendingConquest.fromTerritoryId,
      context.pendingConquest.toTerritoryId,
    );
  }

  if (state.room.phase === "reinforcement") {
    return (
      chooseCardTrade(state, plan, progress, values) ??
      chooseReinforcement(state, plan, progress, values)
    );
  }

  if (state.room.phase === "attack") {
    return chooseAttack(state, plan, progress, values);
  }

  if (state.room.phase === "maneuver") {
    return chooseManeuver(state, plan, progress, values);
  }

  return null;
}
