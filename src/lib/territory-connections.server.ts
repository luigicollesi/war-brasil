import "server-only";

import type { PoolClient } from "pg";
import { getBaseTerritoryConnection } from "@/src/lib/game-topology-service";
import type { TerritoryConnection } from "@/src/lib/territory-connections";

export async function getTerritoryConnection(
  client: PoolClient,
  territoryA: number,
  territoryB: number,
): Promise<TerritoryConnection> {
  return getBaseTerritoryConnection(client, territoryA, territoryB);
}
