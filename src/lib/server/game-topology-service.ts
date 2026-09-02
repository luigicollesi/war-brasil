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

type TopologyCache = {
  all: readonly TerritoryConnection[];
  passable: readonly TerritoryConnection[];
};

let cachedTopology: TopologyCache | null = null;
let loadingTopology: Promise<TopologyCache> | null = null;

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

async function loadTopology(client: PoolClient) {
  if (cachedTopology) return cachedTopology;
  if (loadingTopology) return loadingTopology;

  loadingTopology = client
    .query<ConnectionRow>(
      `SELECT territory_a,territory_b,is_passable,barrier_name,description
       FROM territory_connections
       ORDER BY territory_a,territory_b`,
    )
    .then((result) => result.rows.map(mapConnection))
    .then((all) => {
      cachedTopology = {
        all,
        passable: all.filter((connection) => connection.passable),
      };
      return cachedTopology;
    })
    .catch((error) => {
      cachedTopology = null;
      throw error;
    })
    .finally(() => {
      loadingTopology = null;
    });

  return loadingTopology;
}

export async function getBaseTerritoryConnections(client: PoolClient) {
  return (await loadTopology(client)).all;
}

export async function getPassableTerritoryConnections(client: PoolClient) {
  return (await loadTopology(client)).passable;
}

export async function getBaseTerritoryConnection(
  client: PoolClient,
  territoryA: number,
  territoryB: number,
) {
  const connections = await getBaseTerritoryConnections(client);
  return findTerritoryConnection(connections, territoryA, territoryB);
}
