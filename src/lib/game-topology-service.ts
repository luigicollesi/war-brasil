import "server-only";

import type { PoolClient } from "pg";
import {
  findTerritoryConnection,
  type TerritoryConnection,
} from "@/src/lib/territory-connections";

type ConnectionRow = {
  territory_a: number;
  territory_b: number;
  is_passable: boolean;
  barrier_name: string | null;
  description: string | null;
};

let cachedConnections: readonly TerritoryConnection[] | null = null;
let loadingConnections: Promise<readonly TerritoryConnection[]> | null = null;

function mapConnection(row: ConnectionRow): TerritoryConnection {
  return {
    territoryA: row.territory_a,
    territoryB: row.territory_b,
    exists: true,
    passable: row.is_passable,
    barrierName: row.barrier_name,
    description: row.description,
  };
}

export async function getBaseTerritoryConnections(client: PoolClient) {
  if (cachedConnections) return cachedConnections;
  if (loadingConnections) return loadingConnections;

  loadingConnections = client
    .query<ConnectionRow>(
      `SELECT territory_a,territory_b,is_passable,barrier_name,description
       FROM territory_connections
       ORDER BY territory_a,territory_b`,
    )
    .then((result) => result.rows.map(mapConnection))
    .then((connections) => {
      cachedConnections = connections;
      return cachedConnections;
    })
    .finally(() => {
      loadingConnections = null;
    });

  return loadingConnections;
}

export async function getBaseTerritoryConnection(
  client: PoolClient,
  territoryA: number,
  territoryB: number,
) {
  const connections = await getBaseTerritoryConnections(client);
  return findTerritoryConnection(connections, territoryA, territoryB);
}
