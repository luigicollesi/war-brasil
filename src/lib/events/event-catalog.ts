import {
  EventConfigurationError,
  type EventConnection,
} from "./event-types";

export const INITIAL_EVENT_ID = 0;
export const EVENT_ID_MIN = 0;
export const EVENT_ID_MAX = 37;
export const EVENT_COUNT = EVENT_ID_MAX - EVENT_ID_MIN + 1;
export const EVENT_CONNECTION_COUNT = 195;
export const INITIAL_EVENT_OUTGOING_COUNT = 10;
export const STANDARD_EVENT_OUTGOING_COUNT = 5;

const STANDARD_WEIGHTS = new Set([1, 2, 4]);

function expectedEventIds() {
  return Array.from({ length: EVENT_COUNT }, (_, index) => index + EVENT_ID_MIN);
}

export function assertEventCatalogShape(
  eventIds: readonly number[],
  connections: readonly EventConnection[],
) {
  const sortedEventIds = [...eventIds].sort((a, b) => a - b);
  const expectedIds = expectedEventIds();

  if (
    sortedEventIds.length !== expectedIds.length ||
    sortedEventIds.some((eventId, index) => eventId !== expectedIds[index])
  ) {
    throw new EventConfigurationError(
      `O catálogo precisa conter exatamente os eventos ${EVENT_ID_MIN}–${EVENT_ID_MAX}.`,
    );
  }

  if (connections.length !== EVENT_CONNECTION_COUNT) {
    throw new EventConfigurationError(
      `O grafo precisa conter ${EVENT_CONNECTION_COUNT} conexões de eventos.`,
    );
  }

  const knownEvents = new Set(sortedEventIds);
  const outgoingByEvent = new Map<number, EventConnection[]>();
  const seenPairs = new Set<string>();

  for (const connection of connections) {
    if (
      !knownEvents.has(connection.fromEvent) ||
      !knownEvents.has(connection.toEvent)
    ) {
      throw new EventConfigurationError(
        "O grafo referencia um evento que não existe no catálogo.",
      );
    }

    if (connection.toEvent === INITIAL_EVENT_ID) {
      throw new EventConfigurationError(
        "O evento inicial não pode ser destino de outra anomalia.",
      );
    }

    if (connection.fromEvent === connection.toEvent) {
      throw new EventConfigurationError(
        `Evento ${connection.fromEvent} não pode apontar para si próprio.`,
      );
    }

    if (!Number.isSafeInteger(connection.weight) || connection.weight <= 0) {
      throw new EventConfigurationError(
        "Toda conexão de evento precisa possuir peso inteiro positivo.",
      );
    }

    const pairKey = `${connection.fromEvent}:${connection.toEvent}`;
    if (seenPairs.has(pairKey)) {
      throw new EventConfigurationError(
        `Conexão ${pairKey} aparece mais de uma vez no grafo.`,
      );
    }
    seenPairs.add(pairKey);

    const outgoing = outgoingByEvent.get(connection.fromEvent) ?? [];
    outgoing.push(connection);
    outgoingByEvent.set(connection.fromEvent, outgoing);
  }

  for (const eventId of sortedEventIds) {
    const outgoing = outgoingByEvent.get(eventId) ?? [];
    const expectedCount =
      eventId === INITIAL_EVENT_ID
        ? INITIAL_EVENT_OUTGOING_COUNT
        : STANDARD_EVENT_OUTGOING_COUNT;

    if (outgoing.length !== expectedCount) {
      throw new EventConfigurationError(
        `Evento ${eventId} precisa possuir ${expectedCount} conexões de saída.`,
      );
    }

    if (eventId === INITIAL_EVENT_ID) {
      if (outgoing.some((connection) => connection.weight !== 1)) {
        throw new EventConfigurationError(
          "As conexões iniciais precisam possuir peso 1.",
        );
      }
      continue;
    }

    if (outgoing.some((connection) => !STANDARD_WEIGHTS.has(connection.weight))) {
      throw new EventConfigurationError(
        `Evento ${eventId} possui peso fora do conjunto permitido 1/2/4.`,
      );
    }
  }
}
