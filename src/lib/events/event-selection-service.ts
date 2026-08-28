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
  getLatestRoomEvent,
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
): Promise<NextRoomEventSelection> {
  const current = await getLatestRoomEvent(client, roomId);
  if (!current) {
    throw new EventConfigurationError(
      "A partida ainda não possui um evento atual registrado.",
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
