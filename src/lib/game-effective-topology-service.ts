import "server-only";

import type { PoolClient } from "pg";
import { getRoomRoundEvent } from "./events/event-repository";
import type { ResolvedEventEffect } from "./events/event-types";
import { effectiveGameConnections } from "./game-effective-connections";
import { getBaseTerritoryConnections } from "./game-topology-service";

export type EffectiveGameTopology = {
  connections: ReturnType<typeof effectiveGameConnections>;
  eventId: number | null;
  resolvedEventEffects: ResolvedEventEffect[];
};

export async function getEffectiveGameTopology(
  client: PoolClient,
  input: {
    roomId: string;
    roundNumber: number;
    jurassicTunnelDestinationId: number | null;
  },
): Promise<EffectiveGameTopology> {
  const baseConnections = await getBaseTerritoryConnections(client);
  const roundEvent = await getRoomRoundEvent(
    client,
    input.roomId,
    input.roundNumber,
  );
  const resolvedEventEffects = roundEvent?.resolvedEffects ?? [];

  return {
    connections: effectiveGameConnections(
      baseConnections,
      resolvedEventEffects,
      input.jurassicTunnelDestinationId,
    ),
    eventId: roundEvent?.eventId ?? null,
    resolvedEventEffects,
  };
}
