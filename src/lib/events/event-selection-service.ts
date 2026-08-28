import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import {
  EventConfigurationError,
  type EventConnection,
  type GameEvent,
} from "./event-types";
import {
  EVENT_HISTORY_SIZE,
  eligibleEventConnections,
  selectWeightedEvent,
  totalEventWeight,
} from "./event-selector";
import {
  getEvent,
  getRoomRoundEvent,
  getOutgoingEventConnections,
  getRecentRoomEventIds,
} from "./event-repository";

const MAX_RANDOM_INT_RANGE = 2 ** 48 - 1;

export type NextRoomEventSelection = {
  event: GameEvent;
  connection: EventConnection;
  recentEventIds: number[];
};

export async function chooseNextRoomEvent(
  client: PoolClient,
  roomId: string,
  currentRoundNumber: number,
): Promise<NextRoomEventSelection> {
  const current = await getRoomRoundEvent(
    client,
    roomId,
    currentRoundNumber,
  );
  if (!current) {
    throw new EventConfigurationError(
      `A rodada ${currentRoundNumber} não possui evento atual registrado.`,
    );
  }

  const recentEventIds = await getRecentRoomEventIds(
    client,
    roomId,
    EVENT_HISTORY_SIZE,
  );
  const outgoingConnections = await getOutgoingEventConnections(
    client,
    current.eventId,
  );
  const candidates = eligibleEventConnections(
    outgoingConnections,
    recentEventIds,
  );
  const totalWeight = totalEventWeight(candidates);

  if (totalWeight > MAX_RANDOM_INT_RANGE) {
    throw new EventConfigurationError(
      "A soma dos pesos excede o limite suportado pelo sorteio seguro.",
    );
  }

  const selectedConnection = selectWeightedEvent(
    candidates,
    randomInt(totalWeight),
  );
  const event = await getEvent(client, selectedConnection.toEvent);

  if (!event) {
    throw new EventConfigurationError(
      `Evento ${selectedConnection.toEvent} não foi encontrado.`,
    );
  }

  return {
    event,
    connection: selectedConnection,
    recentEventIds,
  };
}
