import { TERRITORY_METADATA, type Region } from "@/src/lib/game-config";
import type { BotStrategicState } from "./bot-state";

export type BotObjectivePlan =
  | { kind: "territories"; territoryCount: number }
  | {
      kind: "fortification";
      territoryCount: number;
      minimumTroops: number;
    }
  | { kind: "region"; regions: Region[] }
  | {
      kind: "region_territories";
      regions: Region[];
      territoryCount: number;
    }
  | {
      kind: "elimination";
      targetPlayerId: string;
      territoryFloor: number | null;
    }
  | { kind: "generic_expansion" };

export type ObjectiveProgress = {
  ratio: number;
  immediateWinPossible: boolean;
  primaryTargets: number[];
  routeTargets: number[];
  protectedTerritories: number[];
  missingTerritories: number;
};

const REGIONS = [
  "norte",
  "nordeste",
  "centro-oeste",
  "sudeste",
  "sul",
] as const satisfies readonly Region[];

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function regionsParam(value: unknown): Region[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const regions = value.filter(
    (region): region is Region =>
      typeof region === "string" && (REGIONS as readonly string[]).includes(region),
  );
  return regions.length === value.length ? regions : null;
}

export function buildObjectivePlan(state: BotStrategicState): BotObjectivePlan {
  const { type, params, targetPlayerId } = state.objective;

  if (type === "territories") {
    const territoryCount = positiveInteger(params.territories);
    return territoryCount
      ? { kind: "territories", territoryCount }
      : { kind: "generic_expansion" };
  }

  if (type === "fortification") {
    const territoryCount = positiveInteger(params.territories);
    const minimumTroops = positiveInteger(params.minTroops);
    return territoryCount && minimumTroops
      ? { kind: "fortification", territoryCount, minimumTroops }
      : { kind: "generic_expansion" };
  }

  if (type === "regions") {
    const regions = regionsParam(params.regions);
    return regions ? { kind: "region", regions } : { kind: "generic_expansion" };
  }

  if (type === "region_plus") {
    const regions = regionsParam(params.regions);
    const territoryCount = positiveInteger(params.territories);
    return regions && territoryCount
      ? { kind: "region_territories", regions, territoryCount }
      : { kind: "generic_expansion" };
  }

  if ((type === "elimination" || type === "elimination_plus") && targetPlayerId) {
    return {
      kind: "elimination",
      targetPlayerId,
      territoryFloor: positiveInteger(params.territories),
    };
  }

  return { kind: "generic_expansion" };
}

export function territoryIdsForRegions(regions: readonly Region[]) {
  const wanted = new Set(regions);
  return Object.entries(TERRITORY_METADATA)
    .filter(([, metadata]) => wanted.has(metadata.region))
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);
}

function frontierEnemyTerritories(state: BotStrategicState, ownedIds: Set<number>) {
  const targets = new Set<number>();
  for (const connection of state.topology.connections) {
    if (!connection.exists) continue;
    const aOwned = ownedIds.has(connection.territoryA);
    const bOwned = ownedIds.has(connection.territoryB);
    if (aOwned === bOwned) continue;
    targets.add(aOwned ? connection.territoryB : connection.territoryA);
  }
  return Array.from(targets).sort((a, b) => a - b);
}

function ratio(current: number, required: number) {
  return Math.max(0, Math.min(1, required > 0 ? current / required : 0));
}

export function evaluateObjectiveProgress(
  state: BotStrategicState,
  plan: BotObjectivePlan,
): ObjectiveProgress {
  const owned = state.territories.filter(
    (territory) => territory.ownerPlayerId === state.bot.id,
  );
  const ownedIds = new Set(owned.map((territory) => territory.territoryId));
  const genericTargets = frontierEnemyTerritories(state, ownedIds);

  if (plan.kind === "territories") {
    const missing = Math.max(0, plan.territoryCount - owned.length);
    return {
      ratio: ratio(owned.length, plan.territoryCount),
      immediateWinPossible: missing === 1,
      primaryTargets: genericTargets,
      routeTargets: [],
      protectedTerritories: [],
      missingTerritories: missing,
    };
  }

  if (plan.kind === "fortification") {
    const qualified = owned.filter(
      (territory) => territory.troops >= plan.minimumTroops,
    );
    const missingOwned = Math.max(0, plan.territoryCount - owned.length);
    const missingQualified = Math.max(0, plan.territoryCount - qualified.length);
    return {
      ratio: ratio(qualified.length, plan.territoryCount),
      immediateWinPossible:
        missingOwned === 0 && missingQualified === 1 && state.room.reinforcementsRemaining > 0,
      primaryTargets: missingOwned > 0 ? genericTargets : [],
      routeTargets: [],
      protectedTerritories: qualified.map((territory) => territory.territoryId),
      missingTerritories: missingOwned,
    };
  }

  if (plan.kind === "region" || plan.kind === "region_territories") {
    const regionTerritories = territoryIdsForRegions(plan.regions);
    const missingRegion = regionTerritories.filter((id) => !ownedIds.has(id));
    const protectedTerritories = regionTerritories.filter((id) => ownedIds.has(id));
    const regionRatio = ratio(
      regionTerritories.length - missingRegion.length,
      regionTerritories.length,
    );

    if (plan.kind === "region") {
      return {
        ratio: regionRatio,
        immediateWinPossible: missingRegion.length === 1,
        primaryTargets: missingRegion,
        routeTargets: [],
        protectedTerritories,
        missingTerritories: missingRegion.length,
      };
    }

    const missingTotal = Math.max(0, plan.territoryCount - owned.length);
    const territorialRatio = ratio(owned.length, plan.territoryCount);
    return {
      ratio: Math.min(regionRatio, territorialRatio),
      immediateWinPossible:
        missingRegion.length <= 1 && missingTotal <= 1 && (missingRegion.length + missingTotal > 0),
      primaryTargets: Array.from(new Set([...missingRegion, ...genericTargets])).sort(
        (a, b) => a - b,
      ),
      routeTargets: [],
      protectedTerritories,
      missingTerritories: Math.max(missingRegion.length, missingTotal),
    };
  }

  if (plan.kind === "elimination") {
    const targetTerritories = state.territories.filter(
      (territory) => territory.ownerPlayerId === plan.targetPlayerId,
    );
    const floorMissing = Math.max(0, (plan.territoryFloor ?? 0) - owned.length);
    const targetAlive = targetTerritories.length > 0;
    const targetIds = targetTerritories.map((territory) => territory.territoryId).sort((a, b) => a - b);
    return {
      ratio: targetAlive
        ? Math.min(0.99, 1 / (1 + targetTerritories.length) + (plan.territoryFloor ? ratio(owned.length, plan.territoryFloor) * 0.25 : 0))
        : plan.territoryFloor
          ? ratio(owned.length, plan.territoryFloor)
          : 1,
      immediateWinPossible:
        (targetTerritories.length === 1 && floorMissing === 0) ||
        (!targetAlive && floorMissing === 1),
      primaryTargets: targetAlive ? targetIds : genericTargets,
      routeTargets: [],
      protectedTerritories: [],
      missingTerritories: targetAlive ? targetTerritories.length : floorMissing,
    };
  }

  return {
    ratio: 0,
    immediateWinPossible: false,
    primaryTargets: genericTargets,
    routeTargets: [],
    protectedTerritories: [],
    missingTerritories: 0,
  };
}
