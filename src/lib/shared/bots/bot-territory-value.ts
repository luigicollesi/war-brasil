import {
  REGION_REINFORCEMENT_BONUSES,
  TERRITORY_METADATA,
} from "../game-config";
import type { BotStrategicState } from "./bot-state";
import type { BotObjectivePlan, ObjectiveProgress } from "./bot-objective-plan";
import { articulationPoints } from "./bot-routing";

export type TerritoryStrategicValue = {
  objective: number;
  defensive: number;
  routing: number;
  region: number;
  gateway: number;
  denial: number;
  total: number;
};

function neighbors(state: BotStrategicState, territoryId: number) {
  const ids: number[] = [];
  for (const connection of state.topology.connections) {
    if (!connection.exists) continue;
    if (connection.territoryA === territoryId) ids.push(connection.territoryB);
    else if (connection.territoryB === territoryId) ids.push(connection.territoryA);
  }
  return ids;
}

function regionCompletionValue(state: BotStrategicState, territoryId: number) {
  const metadata = TERRITORY_METADATA[territoryId];
  if (!metadata) return 0;
  const regionIds = Object.entries(TERRITORY_METADATA)
    .filter(([, item]) => item.region === metadata.region)
    .map(([id]) => Number(id));
  const owned = new Set(
    state.territories
      .filter((territory) => territory.ownerPlayerId === state.bot.id)
      .map((territory) => territory.territoryId),
  );
  const missing = regionIds.filter((id) => !owned.has(id));
  return missing.length === 1 && missing[0] === territoryId
    ? REGION_REINFORCEMENT_BONUSES[metadata.region] * 4
    : 0;
}

function denialValue(state: BotStrategicState, territoryId: number) {
  const territory = state.territories.find((item) => item.territoryId === territoryId);
  const metadata = TERRITORY_METADATA[territoryId];
  if (!territory || !metadata || territory.ownerPlayerId === state.bot.id) return 0;
  const regionIds = Object.entries(TERRITORY_METADATA)
    .filter(([, item]) => item.region === metadata.region)
    .map(([id]) => Number(id));
  const ownerControlsRegion = regionIds.every((id) =>
    state.territories.some(
      (item) => item.territoryId === id && item.ownerPlayerId === territory.ownerPlayerId,
    ),
  );
  return ownerControlsRegion ? REGION_REINFORCEMENT_BONUSES[metadata.region] * 2 : 0;
}

export function territoryStrategicValues(
  state: BotStrategicState,
  plan: BotObjectivePlan,
  progress: ObjectiveProgress,
) {
  const ownedIds = state.territories
    .filter((territory) => territory.ownerPlayerId === state.bot.id)
    .map((territory) => territory.territoryId);
  const articulation = articulationPoints(state.topology.connections, ownedIds);
  const primary = new Set(progress.primaryTargets);
  const protectedIds = new Set(progress.protectedTerritories);
  const values = new Map<number, TerritoryStrategicValue>();
  for (const territory of state.territories) {
    const neighborIds = neighbors(state, territory.territoryId);
    const enemyNeighbors = neighborIds.filter((id) =>
      state.territories.some(
        (candidate) =>
          candidate.territoryId === id &&
          candidate.ownerPlayerId !== territory.ownerPlayerId,
      ),
    );
    let objective = primary.has(territory.territoryId) ? 12 : 0;
    if (protectedIds.has(territory.territoryId)) objective += 8;
    if (plan.kind === "elimination" && territory.ownerPlayerId === plan.targetPlayerId) objective += 10;
    const defensive = territory.ownerPlayerId === state.bot.id ? Math.min(8, enemyNeighbors.length * 2) : 0;
    const routing = neighborIds.length >= 4 ? 3 : neighborIds.length >= 3 ? 2 : 0;
    const gateway = articulation.has(territory.territoryId) ? 8 : 0;
    const region = regionCompletionValue(state, territory.territoryId);
    const denial = denialValue(state, territory.territoryId);
    const total = objective + defensive + routing + gateway + region + denial;
    values.set(territory.territoryId, { objective, defensive, routing, region, gateway, denial, total });
  }
  return values;
}
