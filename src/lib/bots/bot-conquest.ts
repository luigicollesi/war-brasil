import { isAttackOriginBlocked } from "../events/event-attack-rules";
import type { BotAction } from "./bot-action";
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

export function chooseConquestTransfer(
  state: BotStrategicState,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
  values: ReadonlyMap<number, TerritoryStrategicValue>,
  fromTerritoryId: number,
  toTerritoryId: number,
): BotAction | null {
  const source = state.territories.find(
    (territory) => territory.territoryId === fromTerritoryId,
  );
  const target = state.territories.find(
    (territory) => territory.territoryId === toTerritoryId,
  );
  if (
    !source ||
    !target ||
    source.ownerPlayerId !== state.bot.id ||
    target.ownerPlayerId !== state.bot.id ||
    source.troops < 2
  ) {
    return null;
  }

  const sourceDefense = defenseTarget({
    state,
    territory: source,
    plan,
    progress,
    value: values.get(source.territoryId),
  });
  const targetDefense = defenseTarget({
    state,
    territory: target,
    plan,
    progress,
    value: values.get(target.territoryId),
  });

  const routeTargets = strategicRouteTargets(progress);
  const targetCanAttack = !isAttackOriginBlocked(
    state.topology.resolvedEventEffects,
    target.territoryId,
  );
  const continuationRoute = targetCanAttack
    ? bestStrategicRoute({
        connections: state.topology.connections,
        territories: state.territories,
        playerId: state.bot.id,
        targetTerritoryIds: routeTargets,
        startTerritoryIds: [target.territoryId],
      })
    : null;
  const targetCanContinueObjective =
    continuationRoute?.kind === "reachable" &&
    continuationRoute.path.length >= 2;

  const desiredAtTarget = Math.max(
    targetDefense,
    targetCanContinueObjective ? 4 : 1,
  );
  const maximumMovable = source.troops - 1;
  const safeMovable = Math.max(
    0,
    source.troops - Math.max(1, sourceDefense),
  );
  const preferredMovable = Math.max(1, safeMovable);
  const troops = Math.max(
    1,
    Math.min(maximumMovable, desiredAtTarget, preferredMovable),
  );

  return { type: "complete_conquest", troops };
}
