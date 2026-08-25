import "server-only";

import type { PoolClient } from "pg";
import type { TerritoryConnection } from "@/src/lib/territory-connections";

export async function getTerritoryConnection(
  client: PoolClient,
  territoryA: number,
  territoryB: number,
): Promise<TerritoryConnection> {
  const result = await client.query<{
    territory_a: number;
    territory_b: number;
    is_passable: boolean;
    barrier_name: string | null;
    description: string | null;
  }>(
    `SELECT territory_a, territory_b, is_passable, barrier_name, description
     FROM territory_connections
     WHERE (territory_a = $1 AND territory_b = $2)
        OR (territory_a = $2 AND territory_b = $1)
     LIMIT 1`,
    [territoryA, territoryB],
  );
  const connection = result.rows[0];
  return connection
    ? {
        territoryA: connection.territory_a,
        territoryB: connection.territory_b,
        exists: true,
        passable: connection.is_passable,
        barrierName: connection.barrier_name,
        description: connection.description,
      }
    : {
        territoryA,
        territoryB,
        exists: false,
        passable: false,
        barrierName: null,
        description: null,
      };
}
