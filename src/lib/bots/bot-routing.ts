import type { TerritoryConnection } from "../territory-connections";
import type { BotStrategicTerritory } from "./bot-state";
import { BOT_STRATEGY } from "./bot-strategy-config";

export type StrategicRoute = {
  kind: "reachable" | "unreachable";
  targetTerritoryId: number;
  path: number[];
  cost: number;
  barrierCount: number;
};

type Edge = { to: number; connection: TerritoryConnection };

function adjacency(connections: readonly TerritoryConnection[]) {
  const graph = new Map<number, Edge[]>();
  for (const connection of connections) {
    if (!connection.exists) continue;
    const a = graph.get(connection.territoryA) ?? [];
    const b = graph.get(connection.territoryB) ?? [];
    a.push({ to: connection.territoryB, connection });
    b.push({ to: connection.territoryA, connection });
    graph.set(connection.territoryA, a);
    graph.set(connection.territoryB, b);
  }
  return graph;
}

function territoryMap(territories: readonly BotStrategicTerritory[]) {
  return new Map(territories.map((territory) => [territory.territoryId, territory]));
}

function stepCost(
  territory: BotStrategicTerritory | undefined,
  playerId: string,
  connection: TerritoryConnection,
) {
  const own = territory?.ownerPlayerId === playerId;
  const enemyCost = own
    ? 0
    : (territory?.troops ?? 1) * BOT_STRATEGY.routing.enemyTroopCost;
  const barrierCost = connection.passable
    ? 0
    : BOT_STRATEGY.routing.barrierCost;
  return BOT_STRATEGY.routing.baseStepCost + enemyCost + barrierCost;
}

export function bestStrategicRoute(input: {
  connections: readonly TerritoryConnection[];
  territories: readonly BotStrategicTerritory[];
  playerId: string;
  targetTerritoryIds: readonly number[];
  startTerritoryIds?: readonly number[];
}): StrategicRoute | null {
  const targets = new Set(input.targetTerritoryIds);
  if (targets.size === 0) return null;
  const territories = territoryMap(input.territories);
  const allowedStarts = input.startTerritoryIds
    ? new Set(input.startTerritoryIds)
    : null;
  const starts = input.territories
    .filter(
      (territory) =>
        territory.ownerPlayerId === input.playerId &&
        (!allowedStarts || allowedStarts.has(territory.territoryId)),
    )
    .map((territory) => territory.territoryId)
    .sort((a, b) => a - b);
  if (starts.length === 0) return null;
  const graph = adjacency(input.connections);
  const distance = new Map<number, number>();
  const previous = new Map<
    number,
    { from: number; connection: TerritoryConnection }
  >();
  const unvisited = new Set<number>();
  for (const territory of input.territories) {
    distance.set(territory.territoryId, Number.POSITIVE_INFINITY);
    unvisited.add(territory.territoryId);
  }
  for (const start of starts) distance.set(start, 0);
  while (unvisited.size > 0) {
    let current: number | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const territoryId of unvisited) {
      const candidate = distance.get(territoryId) ?? Number.POSITIVE_INFINITY;
      if (
        candidate < currentDistance ||
        (candidate === currentDistance &&
          current !== null &&
          territoryId < current)
      ) {
        current = territoryId;
        currentDistance = candidate;
      }
    }
    if (current === null || !Number.isFinite(currentDistance)) break;
    unvisited.delete(current);
    for (const edge of graph.get(current) ?? []) {
      if (!unvisited.has(edge.to)) continue;
      const currentTerritory = territories.get(current);
      const nextTerritory = territories.get(edge.to);
      if (
        currentTerritory?.ownerPlayerId === input.playerId &&
        nextTerritory?.ownerPlayerId === input.playerId
      ) {
        continue;
      }
      const candidate =
        currentDistance +
        stepCost(nextTerritory, input.playerId, edge.connection);
      const known = distance.get(edge.to) ?? Number.POSITIVE_INFINITY;
      if (candidate < known) {
        distance.set(edge.to, candidate);
        previous.set(edge.to, { from: current, connection: edge.connection });
      }
    }
  }
  let target: number | null = null;
  let targetCost = Number.POSITIVE_INFINITY;
  for (const candidate of targets) {
    const cost = distance.get(candidate) ?? Number.POSITIVE_INFINITY;
    if (
      cost < targetCost ||
      (cost === targetCost && target !== null && candidate < target)
    ) {
      target = candidate;
      targetCost = cost;
    }
  }
  if (target === null) return null;
  if (!Number.isFinite(targetCost)) {
    return {
      kind: "unreachable",
      targetTerritoryId: target,
      path: [],
      cost: Number.POSITIVE_INFINITY,
      barrierCount: 0,
    };
  }
  const path = [target];
  let barrierCount = 0;
  let current = target;
  const startSet = new Set(starts);
  while (!startSet.has(current)) {
    const step = previous.get(current);
    if (!step) break;
    if (!step.connection.passable) barrierCount += 1;
    current = step.from;
    path.push(current);
    if (path.length > input.territories.length + 1) break;
  }
  return {
    kind: "reachable",
    targetTerritoryId: target,
    path: path.reverse(),
    cost: targetCost,
    barrierCount,
  };
}

export function articulationPoints(
  connections: readonly TerritoryConnection[],
  ownedTerritoryIds: readonly number[],
) {
  const allowed = new Set(ownedTerritoryIds);
  const graph = new Map<number, number[]>();
  for (const territoryId of allowed) graph.set(territoryId, []);
  for (const connection of connections) {
    if (!connection.exists) continue;
    if (
      !allowed.has(connection.territoryA) ||
      !allowed.has(connection.territoryB)
    ) {
      continue;
    }
    graph.get(connection.territoryA)?.push(connection.territoryB);
    graph.get(connection.territoryB)?.push(connection.territoryA);
  }
  let time = 0;
  const discovery = new Map<number, number>();
  const low = new Map<number, number>();
  const parent = new Map<number, number | null>();
  const points = new Set<number>();
  function visit(node: number) {
    time += 1;
    discovery.set(node, time);
    low.set(node, time);
    let children = 0;
    for (const neighbor of graph.get(node) ?? []) {
      if (!discovery.has(neighbor)) {
        children += 1;
        parent.set(neighbor, node);
        visit(neighbor);
        low.set(node, Math.min(low.get(node)!, low.get(neighbor)!));
        if (parent.get(node) == null && children > 1) points.add(node);
        if (
          parent.get(node) != null &&
          low.get(neighbor)! >= discovery.get(node)!
        ) {
          points.add(node);
        }
      } else if (neighbor !== parent.get(node)) {
        low.set(node, Math.min(low.get(node)!, discovery.get(neighbor)!));
      }
    }
  }
  for (const territoryId of allowed) {
    if (!discovery.has(territoryId)) {
      parent.set(territoryId, null);
      visit(territoryId);
    }
  }
  return points;
}
