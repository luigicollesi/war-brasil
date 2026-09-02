import "server-only";

import type { PoolClient } from "pg";
import { getRoomRoundEvent } from "@/src/lib/events/event-repository";
import {
  EventConfigurationError,
  type ResolvedEventEffect,
} from "@/shared/events/event-types";
import { effectiveGameConnections } from "@/shared/game-effective-connections";
import { getBaseTerritoryConnections } from "./game-topology-service";

export type EffectiveGameTopology = {
  connections: ReturnType<typeof effectiveGameConnections>;
  eventId: number;
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
  if (input.jurassicTunnelDestinationId === null) {
    throw new EventConfigurationError(
      `A rodada ${input.roundNumber} não possui Túnel Jurássico ativo.`,
    );
  }

  const roundEvent = await getRoomRoundEvent(
    client,
    input.roomId,
    input.roundNumber,
  );
  if (!roundEvent) {
    throw new EventConfigurationError(
      `A rodada ${input.roundNumber} não possui evento ativo registrado.`,
    );
  }

  const baseConnections = await getBaseTerritoryConnections(client);

  return {
    connections: effectiveGameConnections(
      baseConnections,
      roundEvent.resolvedEffects,
      input.jurassicTunnelDestinationId,
    ),
    eventId: roundEvent.eventId,
    resolvedEventEffects: roundEvent.resolvedEffects,
  };
}
