export type TerritoryConnection = {
  territoryA: number;
  territoryB: number;
  exists: boolean;
  passable: boolean;
  barrierName: string | null;
  description: string | null;
};

export const JURASSIC_TUNNEL_SOURCE_ID = 3;
export const JURASSIC_TUNNEL_EXCLUDED_IDS = [1, 3] as const;

export function isJurassicTunnelConnection(
  destinationTerritoryId: number | null,
  territoryA: number,
  territoryB: number,
) {
  if (!destinationTerritoryId) return false;

  return (
    (territoryA === JURASSIC_TUNNEL_SOURCE_ID && territoryB === destinationTerritoryId) ||
    (territoryB === JURASSIC_TUNNEL_SOURCE_ID && territoryA === destinationTerritoryId)
  );
}

export function jurassicTunnelConnection(
  destinationTerritoryId: number | null,
): TerritoryConnection | null {
  if (!destinationTerritoryId) return null;

  return {
    territoryA: JURASSIC_TUNNEL_SOURCE_ID,
    territoryB: destinationTerritoryId,
    exists: true,
    passable: true,
    barrierName: "Túnel Jurássico",
    description: "Conexão temporária do Acre válida durante esta rodada.",
  };
}

export function findTerritoryConnection(
  connections: readonly TerritoryConnection[],
  territoryA: number,
  territoryB: number,
) {
  const matches = connections.filter(
    (connection) =>
      (connection.territoryA === territoryA && connection.territoryB === territoryB) ||
      (connection.territoryA === territoryB && connection.territoryB === territoryA),
  );

  return matches.find((connection) => connection.passable) ?? matches[0] ?? {
    territoryA,
    territoryB,
    exists: false,
    passable: false,
    barrierName: null,
    description: null,
  };
}

export function reachableTerritoryIds(
  connections: readonly TerritoryConnection[],
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
