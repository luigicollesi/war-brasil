import type { TerritoryConnection } from "@/src/lib/territory-connections";

export type RoadKind = "road";
export type RoadTier = "secondary";

export type Road = {
  id: string;
  fromTerritoryId: number;
  toTerritoryId: number;
  kind: RoadKind;
  tier: RoadTier;
};

function normalizedPair(territoryA: number, territoryB: number) {
  return territoryA < territoryB
    ? [territoryA, territoryB] as const
    : [territoryB, territoryA] as const;
}

export function roadId(territoryA: number, territoryB: number) {
  const [from, to] = normalizedPair(territoryA, territoryB);
  return `road-${from}-${to}`;
}

export function roadsFromConnections(
  connections: TerritoryConnection[],
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
      kind: "road",
      tier: "secondary",
    });
  }

  return Array.from(roads.values()).sort((first, second) =>
    first.fromTerritoryId - second.fromTerritoryId ||
    first.toTerritoryId - second.toTerritoryId,
  );
}
