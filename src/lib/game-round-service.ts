import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { INITIAL_EVENT_ID } from "@/src/lib/events/event-catalog";
import { applyPermanentEventEffects, type EventTerritoryUpdate } from "@/src/lib/events/event-effects-service";
import { recordRoundEvent, getEvent } from "@/src/lib/events/event-repository";
import { resolveGameEventEffects } from "@/src/lib/events/event-resolution-service";
import { chooseNextRoomEvent } from "@/src/lib/events/event-selection-service";
import {
  EventConfigurationError,
  type ResolvedEventEffect,
} from "@/src/lib/events/event-types";
import { TERRITORY_METADATA } from "@/src/lib/game-config";
import { chooseJurassicTunnelDestination } from "@/src/lib/game-round-rules";

export type RoundActivation = {
  roundNumber: number;
  jurassicTunnelDestinationId: number;
  eventId: number;
  resolvedEffects: ResolvedEventEffect[];
  territoryUpdates: EventTerritoryUpdate[];
};

function territoryIds() {
  return Object.keys(TERRITORY_METADATA).map(Number);
}

function nextTunnel(previousDestination: number | null) {
  return chooseJurassicTunnelDestination(
    territoryIds(),
    previousDestination,
    (exclusiveMax) => randomInt(exclusiveMax),
  );
}

export async function initializeFirstGameRound(
  client: PoolClient,
  roomId: string,
): Promise<RoundActivation> {
  const initialEvent = await getEvent(client, INITIAL_EVENT_ID);
  if (!initialEvent) {
    throw new EventConfigurationError(
      `Evento inicial ${INITIAL_EVENT_ID} não foi encontrado.`,
    );
  }

  const jurassicTunnelDestinationId = nextTunnel(null);

  const roundEvent = await recordRoundEvent(client, {
    roomId,
    roundNumber: 1,
    eventId: INITIAL_EVENT_ID,
    // O evento 0 é exclusivamente narrativo: a distribuição inicial de uma
    // tropa por território já é feita pela inicialização normal da partida.
    resolvedEffects: [],
  });

  return {
    roundNumber: 1,
    jurassicTunnelDestinationId,
    eventId: roundEvent.eventId,
    resolvedEffects: [],
    territoryUpdates: [],
  };
}

export async function advanceGameRound(
  client: PoolClient,
  input: {
    roomId: string;
    currentRoundNumber: number;
    previousJurassicTunnelDestinationId: number | null;
  },
): Promise<RoundActivation> {
  if (!Number.isInteger(input.currentRoundNumber) || input.currentRoundNumber < 1) {
    throw new RangeError("A rodada atual precisa ser um inteiro positivo.");
  }

  if (input.previousJurassicTunnelDestinationId === null) {
    throw new EventConfigurationError(
      `A rodada ${input.currentRoundNumber} não possui Túnel Jurássico ativo.`,
    );
  }

  const nextRoundNumber = input.currentRoundNumber + 1;
  const jurassicTunnelDestinationId = nextTunnel(
    input.previousJurassicTunnelDestinationId,
  );

  const selection = await chooseNextRoomEvent(
    client,
    input.roomId,
    input.currentRoundNumber,
  );

  const resolvedEffects = await resolveGameEventEffects(client, {
    effects: selection.event.effects,
    jurassicTunnelDestinationId,
  });

  await recordRoundEvent(client, {
    roomId: input.roomId,
    roundNumber: nextRoundNumber,
    eventId: selection.event.id,
    resolvedEffects,
  });

  const territoryUpdates = await applyPermanentEventEffects(
    client,
    input.roomId,
    resolvedEffects,
  );

  await client.query(
    `UPDATE game_rooms
     SET round_number=$2,jurassic_tunnel_territory_id=$3
     WHERE id=$1`,
    [input.roomId, nextRoundNumber, jurassicTunnelDestinationId],
  );

  return {
    roundNumber: nextRoundNumber,
    jurassicTunnelDestinationId,
    eventId: selection.event.id,
    resolvedEffects,
    territoryUpdates,
  };
}
