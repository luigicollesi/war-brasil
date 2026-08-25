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
