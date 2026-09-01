import { maneuverTraversalProfile } from "../game-barrier-rules";
import { maneuverMovableTroops } from "../game-rules";
import { bestTerritoryRoute } from "../territory-routing";
import type { BotAction } from "./bot-action";
import { defenseTarget } from "./bot-defense";
import type { BotObjectivePlan, ObjectiveProgress } from "./bot-objective-plan";
import type { BotStrategicState } from "./bot-state";
import type { TerritoryStrategicValue } from "./bot-territory-value";

export function chooseManeuver(
  state: BotStrategicState,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
  values: ReadonlyMap<number, TerritoryStrategicValue>,
): BotAction {
  const owned = state.territories.filter(
    (territory) => territory.ownerPlayerId === state.bot.id,
  );
  if (owned.some((territory) => territory.movedInTurn > 0)) {
    return { type: "end_turn" };
  }

  const ownedIds = owned.map((territory) => territory.territoryId);
  let best: {
    score: number;
    fromTerritoryId: number;
    toTerritoryId: number;
    troops: number;
  } | null = null;

  for (const source of owned) {
    const reserve = defenseTarget({
      state,
      territory: source,
      plan,
      progress,
      value: values.get(source.territoryId),
    });
    const movableByRule = maneuverMovableTroops(source.troops, source.movedInTurn);
    const strategicSurplus = Math.max(
      0,
      source.troops - source.movedInTurn - Math.max(1, reserve),
    );
    const surplus = Math.min(movableByRule, strategicSurplus);
    if (surplus < 1) continue;

    for (const destination of owned) {
      if (destination.territoryId === source.territoryId) continue;
      const route = bestTerritoryRoute(
        state.topology.connections,
        source.territoryId,
        destination.territoryId,
        ownedIds,
      );
      if (route.kind === "unreachable") continue;
      const traversal = maneuverTraversalProfile(route.barrierCount);
      if (traversal.kind === "blocked" || surplus < traversal.minimumTroops) continue;

      let desired = defenseTarget({
        state,
        territory: destination,
        plan,
        progress,
        value: values.get(destination.territoryId),
      });
      if (plan.kind === "fortification") {
        desired = Math.max(desired, plan.minimumTroops);
      }
      const deficit = Math.max(0, desired - destination.troops);
      const sourceValue = values.get(source.territoryId)?.total ?? 0;
      const destinationValue = values.get(destination.territoryId)?.total ?? 0;
      if (deficit === 0 && destinationValue <= sourceValue) continue;

      const neededToSend = Math.max(
        traversal.minimumTroops,
        deficit + traversal.troopLoss,
      );
      const troops = Math.min(surplus, neededToSend);
      if (troops < traversal.minimumTroops) continue;
      const arriving = troops - traversal.troopLoss;
      if (arriving < 1) continue;

      const score =
        deficit * 20 +
        (destinationValue - sourceValue) * 2 -
        traversal.troopLoss * 10;
      if (
        !best ||
        score > best.score ||
        (score === best.score &&
          (source.territoryId < best.fromTerritoryId ||
            (source.territoryId === best.fromTerritoryId &&
              destination.territoryId < best.toTerritoryId)))
      ) {
        best = {
          score,
          fromTerritoryId: source.territoryId,
          toTerritoryId: destination.territoryId,
          troops,
        };
      }
    }
  }

  if (!best || best.score <= 0) return { type: "end_turn" };
  return {
    type: "maneuver",
    fromTerritoryId: best.fromTerritoryId,
    toTerritoryId: best.toTerritoryId,
    troops: best.troops,
  };
}
