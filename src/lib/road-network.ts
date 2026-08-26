import type { TerritoryConnection } from "@/src/lib/territory-connections";

type Road = {
  id: string;
  fromTerritoryId: number;
  toTerritoryId: number;
};

function normalizedPair(territoryA: number, territoryB: number) {
  return territoryA < territoryB
    ? ([territoryA, territoryB] as const)
    : ([territoryB, territoryA] as const);
}

function roadId(territoryA: number, territoryB: number) {
  const [from, to] = normalizedPair(territoryA, territoryB);
  return `road-${from}-${to}`;
}

export function roadsFromConnections(
  connections: readonly TerritoryConnection[],
): Road[] {
  const roads = new Map<string, Road>();

  for (const connection of connections) {
    if (
      !connection.exists ||
      !connection.passable ||
      connection.barrierName === "Túnel Jurássico"
    ) {
      continue;
    }

    const [fromTerritoryId, toTerritoryId] = normalizedPair(
      connection.territoryA,
      connection.territoryB,
    );
    const id = roadId(fromTerritoryId, toTerritoryId);

    roads.set(id, {
      id,
      fromTerritoryId,
      toTerritoryId,
    });
  }

  return Array.from(roads.values()).sort(
    (first, second) =>
      first.fromTerritoryId - second.fromTerritoryId ||
      first.toTerritoryId - second.toTerritoryId,
  );
}
