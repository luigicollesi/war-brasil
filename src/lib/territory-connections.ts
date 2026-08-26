export type TerritoryConnection = {
  territoryA: number;
  territoryB: number;
  exists: boolean;
  passable: boolean;
  barrierName: string | null;
  description: string | null;
};

export function findTerritoryConnection(
  connections: TerritoryConnection[],
  territoryA: number,
  territoryB: number,
) {
  return connections.find(
    (connection) =>
      (connection.territoryA === territoryA && connection.territoryB === territoryB) ||
      (connection.territoryA === territoryB && connection.territoryB === territoryA),
  ) ?? {
    territoryA,
    territoryB,
    exists: false,
    passable: false,
    barrierName: null,
    description: null,
  };
}


export function reachableTerritoryIds(
  connections: TerritoryConnection[],
  startTerritoryId: number,
  allowedTerritoryIds: Iterable<number>,
) {
  const allowed = new Set(allowedTerritoryIds);

  if (!allowed.has(startTerritoryId)) {
    return [];
  }

  const visited = new Set<number>([startTerritoryId]);
  const queue = [startTerritoryId];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];

    for (const connection of connections) {
      if (!connection.exists || !connection.passable) {
        continue;
      }

      let neighbor: number | null = null;

      if (connection.territoryA === current) {
        neighbor = connection.territoryB;
      } else if (connection.territoryB === current) {
        neighbor = connection.territoryA;
      }

      if (
        neighbor !== null &&
        allowed.has(neighbor) &&
        !visited.has(neighbor)
      ) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return Array.from(visited);
}
