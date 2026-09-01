import { attackProfile, type AttackMode } from "../game-barrier-rules";
import { isAttackOriginBlocked } from "../events/event-attack-rules";
import type { BotAction } from "./bot-action";
import { forecastConquest, type CombatForecast } from "./bot-combat-odds";
import { availableForOffense, defenseTarget } from "./bot-defense";
import type { BotObjectivePlan, ObjectiveProgress } from "./bot-objective-plan";
import { bestStrategicRoute } from "./bot-routing";
import type { BotStrategicState, BotStrategicTerritory } from "./bot-state";
import type { TerritoryStrategicValue } from "./bot-territory-value";
import { BOT_STRATEGY } from "./bot-strategy-config";

export type AttackCandidate = {
  fromTerritoryId: number;
  toTerritoryId: number;
  mode: AttackMode;
  forecast: CombatForecast;
  score: number;
};

function territoryById(state: BotStrategicState) {
  return new Map(state.territories.map((territory) => [territory.territoryId, territory]));
}

function candidateFor(
  state: BotStrategicState,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
  values: ReadonlyMap<number, TerritoryStrategicValue>,
  source: BotStrategicTerritory,
  target: BotStrategicTerritory,
  passable: boolean,
  routeStep: number | null,
): AttackCandidate | null {
  if (isAttackOriginBlocked(state.topology.resolvedEventEffects, source.territoryId)) {
    return null;
  }

  const sourceDefense = defenseTarget({
    state,
    territory: source,
    plan,
    progress,
    value: values.get(source.territoryId),
  });
  if (availableForOffense(source, sourceDefense) < 1) return null;

  const mode: AttackMode = passable ? "normal" : "barrier";
  const profile = attackProfile(source.troops, mode);
  if (profile.kind === "unavailable") return null;

  const forecast = forecastConquest(source.troops, target.troops, mode);
  const primary = progress.primaryTargets.includes(target.territoryId);
  const targetValue = values.get(target.territoryId);
  const expectedRemaining = source.troops - forecast.expectedAttackerLosses;
  const defenseDamage = Math.max(0, sourceDefense - expectedRemaining);
  const eliminationTarget =
    plan.kind === "elimination" && target.ownerPlayerId === plan.targetPlayerId;

  const objectiveGain =
    (primary ? BOT_STRATEGY.attack.objectiveWeight : 0) +
    (eliminationTarget ? BOT_STRATEGY.attack.objectiveWeight * 0.45 : 0);
  const routeGain =
    routeStep === target.territoryId ? BOT_STRATEGY.attack.routeWeight : 0;
  const regionGain = (targetValue?.region ?? 0) * 2;
  const positionalGain = Math.min(
    BOT_STRATEGY.attack.positionalWeight * 2,
    (targetValue?.total ?? 0) * 1.5,
  );
  const probabilityGain =
    forecast.conquestProbability * BOT_STRATEGY.attack.conquestProbabilityWeight;
  const lossCost =
    forecast.expectedAttackerLosses * BOT_STRATEGY.attack.expectedLossWeight;
  const defenseCost = defenseDamage * BOT_STRATEGY.attack.defenseDamageWeight;
  const barrierTiebreak = mode === "barrier" ? 8 : 0;

  return {
    fromTerritoryId: source.territoryId,
    toTerritoryId: target.territoryId,
    mode,
    forecast,
    score:
      objectiveGain +
      routeGain +
      regionGain +
      positionalGain +
      probabilityGain -
      lossCost -
      defenseCost -
      barrierTiebreak,
  };
}

export function enumerateAttackCandidates(
  state: BotStrategicState,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
  values: ReadonlyMap<number, TerritoryStrategicValue>,
) {
  const territories = territoryById(state);
  const route = bestStrategicRoute({
    connections: state.topology.connections,
    territories: state.territories,
    playerId: state.bot.id,
    targetTerritoryIds: progress.primaryTargets,
  });
  const routeStep = route?.kind === "reachable" && route.path.length >= 2
    ? route.path[1]
    : null;
  const candidates: AttackCandidate[] = [];

  for (const connection of state.topology.connections) {
    if (!connection.exists) continue;
    const first = territories.get(connection.territoryA);
    const second = territories.get(connection.territoryB);
    if (!first || !second) continue;

    let source: BotStrategicTerritory | null = null;
    let target: BotStrategicTerritory | null = null;
    if (first.ownerPlayerId === state.bot.id && second.ownerPlayerId !== state.bot.id) {
      source = first;
      target = second;
    } else if (
      second.ownerPlayerId === state.bot.id &&
      first.ownerPlayerId !== state.bot.id
    ) {
      source = second;
      target = first;
    }
    if (!source || !target) continue;

    const candidate = candidateFor(
      state,
      plan,
      progress,
      values,
      source,
      target,
      connection.passable,
      routeStep,
    );
    if (candidate) candidates.push(candidate);
  }

  return candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (left.fromTerritoryId !== right.fromTerritoryId) {
      return left.fromTerritoryId - right.fromTerritoryId;
    }
    return left.toTerritoryId - right.toTerritoryId;
  });
}

export function chooseAttack(
  state: BotStrategicState,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
  values: ReadonlyMap<number, TerritoryStrategicValue>,
): BotAction {
  const candidates = enumerateAttackCandidates(state, plan, progress, values);
  const best = candidates[0];
  if (!best) return { type: "finish_attack" };

  const primary = progress.primaryTargets.includes(best.toTerritoryId);
  const probabilityThreshold =
    primary && progress.immediateWinPossible
      ? BOT_STRATEGY.attack.objectivePushProbability
      : BOT_STRATEGY.attack.minimumConquestProbability;

  if (
    best.forecast.conquestProbability < probabilityThreshold ||
    best.score < BOT_STRATEGY.attack.attackThreshold
  ) {
    return { type: "finish_attack" };
  }

  return {
    type: "attack",
    fromTerritoryId: best.fromTerritoryId,
    toTerritoryId: best.toTerritoryId,
  };
}
