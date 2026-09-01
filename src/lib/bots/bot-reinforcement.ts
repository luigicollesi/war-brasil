import { isAttackOriginBlocked } from "../events/event-attack-rules";
import type { BotAction } from "./bot-action";
import { bestCardConquestCandidate } from "./bot-card-conquest";
import { defenseTarget } from "./bot-defense";
import type {
  BotObjectivePlan,
  ObjectiveProgress,
} from "./bot-objective-plan";
import { bestStrategicRoute } from "./bot-routing";
import type { BotStrategicState } from "./bot-state";
import type { TerritoryStrategicValue } from "./bot-territory-value";

function strategicRouteTargets(progress: ObjectiveProgress) {
  return progress.primaryTargets.length > 0
    ? progress.primaryTargets
    : progress.routeTargets;
}

function fortificationCandidate(
  state: BotStrategicState,
  plan: Extract<BotObjectivePlan, { kind: "fortification" }>,
  values: ReadonlyMap<number, TerritoryStrategicValue>,
) {
  const owned = state.territories.filter(
    (territory) => territory.ownerPlayerId === state.bot.id,
  );
  const candidates = owned
    .filter((territory) => territory.troops < plan.minimumTroops)
    .map((territory) => ({
      territory,
      gap: plan.minimumTroops - territory.troops,
      value: values.get(territory.territoryId)?.total ?? 0,
    }))
    .sort((left, right) => {
      if (left.gap !== right.gap) return left.gap - right.gap;
      if (right.value !== left.value) return right.value - left.value;
      return left.territory.territoryId - right.territory.territoryId;
    });
  const neededQualified = Math.max(
    0,
    plan.territoryCount -
      owned.filter((territory) => territory.troops >= plan.minimumTroops).length,
  );
  return neededQualified > 0 ? candidates[0] ?? null : null;
}

export function chooseReinforcement(
  state: BotStrategicState,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
  values: ReadonlyMap<number, TerritoryStrategicValue>,
): BotAction | null {
  const remaining = state.room.reinforcementsRemaining;
  if (remaining < 1) return null;

  const owned = state.territories
    .filter((territory) => territory.ownerPlayerId === state.bot.id)
    .sort((a, b) => a.territoryId - b.territoryId);
  if (owned.length === 0) return null;

  if (plan.kind === "fortification" && progress.immediateWinPossible) {
    const candidate = fortificationCandidate(state, plan, values);
    if (candidate) {
      return {
        type: "reinforce",
        territoryId: candidate.territory.territoryId,
        troops: Math.min(remaining, candidate.gap),
      };
    }
  }

  if (!state.room.conqueredThisTurn) {
    const cardConquest = bestCardConquestCandidate(
      state,
      plan,
      progress,
      values,
      remaining,
    );
    if (cardConquest) {
      return {
        type: "reinforce",
        territoryId: cardConquest.fromTerritoryId,
        troops: remaining,
      };
    }
  }

  if (plan.kind === "fortification") {
    const candidate = fortificationCandidate(state, plan, values);
    if (candidate) {
      return {
        type: "reinforce",
        territoryId: candidate.territory.territoryId,
        troops: Math.min(remaining, candidate.gap),
      };
    }
  }

  const defensive = owned
    .map((territory) => {
      const target = defenseTarget({
        state,
        territory,
        plan,
        progress,
        value: values.get(territory.territoryId),
      });
      return {
        territory,
        target,
        deficit: Math.max(0, target - territory.troops),
        value: values.get(territory.territoryId)?.total ?? 0,
      };
    })
    .filter((candidate) => candidate.deficit > 0)
    .sort((left, right) => {
      if (right.value !== left.value) return right.value - left.value;
      if (right.deficit !== left.deficit) return right.deficit - left.deficit;
      return left.territory.territoryId - right.territory.territoryId;
    });

  if (defensive[0]) {
    return {
      type: "reinforce",
      territoryId: defensive[0].territory.territoryId,
      troops: Math.min(remaining, defensive[0].deficit),
    };
  }

  const offensiveStarts = owned
    .filter(
      (territory) =>
        !isAttackOriginBlocked(
          state.topology.resolvedEventEffects,
          territory.territoryId,
        ),
    )
    .map((territory) => territory.territoryId);
  const route = bestStrategicRoute({
    connections: state.topology.connections,
    territories: state.territories,
    playerId: state.bot.id,
    targetTerritoryIds: strategicRouteTargets(progress),
    startTerritoryIds: offensiveStarts,
  });
  if (route?.kind === "reachable" && route.path.length >= 2) {
    return {
      type: "reinforce",
      territoryId: route.path[0],
      troops: remaining,
    };
  }

  const fallback = [...owned].sort((left, right) => {
    const valueDifference =
      (values.get(right.territoryId)?.total ?? 0) -
      (values.get(left.territoryId)?.total ?? 0);
    return valueDifference || left.territoryId - right.territoryId;
  })[0];

  return {
    type: "reinforce",
    territoryId: fallback.territoryId,
    troops: remaining,
  };
}
