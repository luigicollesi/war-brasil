import type { BotStrategicState, BotStrategicTerritory } from "./bot-state";
import type { BotObjectivePlan, ObjectiveProgress } from "./bot-objective-plan";
import type { TerritoryStrategicValue } from "./bot-territory-value";
import { BOT_STRATEGY } from "./bot-strategy-config";

function enemyNeighbors(state: BotStrategicState, territoryId: number) {
  const neighbors: BotStrategicTerritory[] = [];
  for (const connection of state.topology.connections) {
    if (!connection.exists) continue;
    const neighborId =
      connection.territoryA === territoryId
        ? connection.territoryB
        : connection.territoryB === territoryId
          ? connection.territoryA
          : null;
    if (neighborId === null) continue;
    const territory = state.territories.find(
      (candidate) => candidate.territoryId === neighborId,
    );
    if (territory && territory.ownerPlayerId !== state.bot.id) neighbors.push(territory);
  }
  return neighbors;
}

export function defenseTarget(input: {
  state: BotStrategicState;
  territory: BotStrategicTerritory;
  plan: BotObjectivePlan;
  progress: ObjectiveProgress;
  value?: TerritoryStrategicValue;
}) {
  const { state, territory, plan, progress, value } = input;
  if (territory.ownerPlayerId !== state.bot.id) return 0;

  const enemies = enemyNeighbors(state, territory.territoryId);
  let target = 1;

  if (enemies.length > 0) target = BOT_STRATEGY.defense.secondaryFrontierTarget;
  if ((value?.total ?? 0) >= 10 || enemies.length >= 2) {
    target = Math.max(target, BOT_STRATEGY.defense.keyFrontierTarget);
  }
  if ((value?.gateway ?? 0) > 0) {
    target = Math.max(target, BOT_STRATEGY.defense.criticalGatewayTarget);
  }

  const strongestEnemy = enemies.reduce(
    (max, enemy) => Math.max(max, enemy.troops),
    0,
  );
  if (strongestEnemy >= territory.troops * 2 && strongestEnemy >= 6) {
    target = Math.max(target, BOT_STRATEGY.defense.criticalGatewayTarget);
  }

  if (
    plan.kind === "fortification" &&
    progress.protectedTerritories.includes(territory.territoryId)
  ) {
    target = Math.max(target, plan.minimumTroops);
  }

  if (progress.protectedTerritories.includes(territory.territoryId)) {
    target = Math.max(target, BOT_STRATEGY.defense.keyFrontierTarget);
  }

  return target;
}

export function availableForOffense(
  territory: BotStrategicTerritory,
  defenseReserve: number,
) {
  return Math.max(0, territory.troops - Math.max(1, defenseReserve));
}
