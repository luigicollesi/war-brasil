import { attackProfile, type AttackMode } from "../game-barrier-rules";
import { isAttackOriginBlocked } from "../events/event-attack-rules";
import { forecastConquest } from "./bot-combat-odds";
import type {
  BotObjectivePlan,
  ObjectiveProgress,
} from "./bot-objective-plan";
import type {
  BotStrategicState,
  BotStrategicTerritory,
} from "./bot-state";
import type { TerritoryStrategicValue } from "./bot-territory-value";

export type CardConquestCandidate = {
  fromTerritoryId: number;
  toTerritoryId: number;
  mode: AttackMode;
  troopsNeeded: number;
  projectedAttackerTroops: number;
  defenderTroops: number;
  conquestProbability: number;
  score: number;
};

function territoryMap(state: BotStrategicState) {
  return new Map(
    state.territories.map((territory) => [territory.territoryId, territory]),
  );
}

function minimumTroopsForCardAttack(
  mode: AttackMode,
  target: BotStrategicTerritory,
) {
  return mode === "barrier"
    ? Math.max(10, target.troops + 1)
    : Math.max(2, target.troops + 1);
}

function isProtectedFortificationSource(
  source: BotStrategicTerritory,
  projectedTroops: number,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
) {
  return (
    plan.kind === "fortification" &&
    progress.protectedTerritories.includes(source.territoryId) &&
    projectedTroops <= plan.minimumTroops
  );
}

function objectivePriority(
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
  target: BotStrategicTerritory,
  value: TerritoryStrategicValue | undefined,
) {
  let score = 0;
  if (
    progress.immediateWinPossible &&
    progress.primaryTargets.includes(target.territoryId)
  ) {
    score += 1000;
  }
  if (progress.primaryTargets.includes(target.territoryId)) score += 320;
  if (progress.routeTargets.includes(target.territoryId)) score += 160;
  if (
    plan.kind === "elimination" &&
    target.ownerPlayerId === plan.targetPlayerId
  ) {
    score += 260;
  }
  score += Math.min(120, Math.max(0, value?.total ?? 0) * 4);
  return score;
}

function buildCandidate(input: {
  state: BotStrategicState;
  plan: BotObjectivePlan;
  progress: ObjectiveProgress;
  values: ReadonlyMap<number, TerritoryStrategicValue>;
  source: BotStrategicTerritory;
  target: BotStrategicTerritory;
  mode: AttackMode;
  availableReinforcements: number;
}) {
  const {
    state,
    plan,
    progress,
    values,
    source,
    target,
    mode,
    availableReinforcements,
  } = input;

  if (
    isAttackOriginBlocked(
      state.topology.resolvedEventEffects,
      source.territoryId,
    )
  ) {
    return null;
  }

  const requiredTroops = minimumTroopsForCardAttack(mode, target);
  const troopsNeeded = Math.max(0, requiredTroops - source.troops);
  if (troopsNeeded > availableReinforcements) return null;

  const projectedAttackerTroops = source.troops + availableReinforcements;
  if (projectedAttackerTroops <= target.troops) return null;

  const profile = attackProfile(projectedAttackerTroops, mode);
  if (profile.kind === "unavailable") return null;
  if (mode === "barrier" && profile.diceCount !== 3) return null;

  if (
    isProtectedFortificationSource(
      source,
      projectedAttackerTroops,
      plan,
      progress,
    )
  ) {
    return null;
  }

  const forecast = forecastConquest(
    projectedAttackerTroops,
    target.troops,
    mode,
  );
  const score =
    objectivePriority(plan, progress, target, values.get(target.territoryId)) +
    forecast.conquestProbability * 200 -
    troopsNeeded * 10 -
    target.troops * 2;

  return {
    fromTerritoryId: source.territoryId,
    toTerritoryId: target.territoryId,
    mode,
    troopsNeeded,
    projectedAttackerTroops,
    defenderTroops: target.troops,
    conquestProbability: forecast.conquestProbability,
    score,
  } satisfies CardConquestCandidate;
}

export function cardConquestCandidates(
  state: BotStrategicState,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
  values: ReadonlyMap<number, TerritoryStrategicValue>,
  availableReinforcements = 0,
) {
  if (state.room.conqueredThisTurn) return [];

  const territories = territoryMap(state);
  const normal: CardConquestCandidate[] = [];
  const barrier: CardConquestCandidate[] = [];

  for (const connection of state.topology.connections) {
    if (!connection.exists) continue;
    const first = territories.get(connection.territoryA);
    const second = territories.get(connection.territoryB);
    if (!first || !second) continue;

    let source: BotStrategicTerritory | null = null;
    let target: BotStrategicTerritory | null = null;
    if (
      first.ownerPlayerId === state.bot.id &&
      second.ownerPlayerId !== state.bot.id
    ) {
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

    const mode: AttackMode = connection.passable ? "normal" : "barrier";
    const candidate = buildCandidate({
      state,
      plan,
      progress,
      values,
      source,
      target,
      mode,
      availableReinforcements,
    });
    if (!candidate) continue;
    (mode === "normal" ? normal : barrier).push(candidate);
  }

  const sortCandidates = (left: CardConquestCandidate, right: CardConquestCandidate) => {
    if (right.score !== left.score) return right.score - left.score;
    if (left.troopsNeeded !== right.troopsNeeded) {
      return left.troopsNeeded - right.troopsNeeded;
    }
    if (left.fromTerritoryId !== right.fromTerritoryId) {
      return left.fromTerritoryId - right.fromTerritoryId;
    }
    return left.toTerritoryId - right.toTerritoryId;
  };

  normal.sort(sortCandidates);
  barrier.sort(sortCandidates);
  return normal.length > 0 ? normal : barrier;
}

export function bestCardConquestCandidate(
  state: BotStrategicState,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
  values: ReadonlyMap<number, TerritoryStrategicValue>,
  availableReinforcements = 0,
) {
  return (
    cardConquestCandidates(
      state,
      plan,
      progress,
      values,
      availableReinforcements,
    )[0] ?? null
  );
}
