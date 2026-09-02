import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { getBaseTerritoryConnections } from "../game-topology-service";
import { JURASSIC_TUNNEL_SOURCE_ID } from "../game-round-rules";
import {
  canonicalTerritoryConnectionPair,
  type EventEffect,
  type ResolvedEventEffect,
  type TerritoryConnectionPair,
} from "./event-types";
import { resolveEventEffects } from "./event-resolver";

function protectedJurassicConnection(
  destinationTerritoryId: number | null,
): TerritoryConnectionPair[] {
  return destinationTerritoryId === null
    ? []
    : [
        canonicalTerritoryConnectionPair(
          JURASSIC_TUNNEL_SOURCE_ID,
          destinationTerritoryId,
        ),
      ];
}

export async function resolveGameEventEffects(
  client: PoolClient,
  input: {
    effects: readonly EventEffect[];
    jurassicTunnelDestinationId: number | null;
  },
): Promise<ResolvedEventEffect[]> {
  const baseConnections = await getBaseTerritoryConnections(client);

  return resolveEventEffects({
    effects: input.effects,
    baseConnections,
    randomIndex: (exclusiveMax) => randomInt(exclusiveMax),
    protectedConnections: protectedJurassicConnection(
      input.jurassicTunnelDestinationId,
    ),
  });
}
