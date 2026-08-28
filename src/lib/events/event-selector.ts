import {
  EventConfigurationError,
  type EventConnection,
} from "./event-types";

export const EVENT_HISTORY_SIZE = 4;

function assertConnectionSet(connections: readonly EventConnection[]) {
  if (connections.length === 0) {
    throw new EventConfigurationError(
      "O evento atual não possui conexões de saída configuradas.",
    );
  }

  const fromEvent = connections[0].fromEvent;
  const destinations = new Set<number>();

  for (const connection of connections) {
    if (
      !Number.isInteger(connection.fromEvent) ||
      connection.fromEvent < 0 ||
      !Number.isInteger(connection.toEvent) ||
      connection.toEvent <= 0
    ) {
      throw new EventConfigurationError("Conexão de evento possui IDs inválidos.");
    }
    if (connection.fromEvent !== fromEvent) {
      throw new EventConfigurationError(
        "O selector recebeu conexões de eventos de origem diferentes.",
      );
    }
    if (!Number.isSafeInteger(connection.weight) || connection.weight <= 0) {
      throw new EventConfigurationError(
        "Peso de conexão de evento precisa ser um inteiro positivo.",
      );
    }
    if (destinations.has(connection.toEvent)) {
      throw new EventConfigurationError(
        `Evento ${connection.toEvent} aparece mais de uma vez entre os sucessores.`,
      );
    }
    destinations.add(connection.toEvent);
  }
}

export function eligibleEventConnections(
  connections: readonly EventConnection[],
  recentEventIds: readonly number[],
): EventConnection[] {
  assertConnectionSet(connections);

  const recent = new Set(recentEventIds.slice(0, EVENT_HISTORY_SIZE));
  recent.add(connections[0].fromEvent);

  const filtered = connections.filter(
    (connection) => !recent.has(connection.toEvent),
  );

  return [...(filtered.length > 0 ? filtered : connections)];
}

export function totalEventWeight(connections: readonly EventConnection[]) {
  assertConnectionSet(connections);

  const total = connections.reduce(
    (sum, connection) => sum + connection.weight,
    0,
  );

  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new EventConfigurationError(
      "A soma dos pesos das conexões de evento é inválida.",
    );
  }

  return total;
}

export function selectWeightedEvent(
  connections: readonly EventConnection[],
  ticket: number,
): EventConnection {
  const total = totalEventWeight(connections);

  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= total) {
    throw new EventConfigurationError(
      `Ticket de sorteio precisa estar entre 0 e ${total - 1}.`,
    );
  }

  let cursor = ticket;
  for (const connection of connections) {
    if (cursor < connection.weight) {
      return connection;
    }
    cursor -= connection.weight;
  }

  throw new EventConfigurationError(
    "Não foi possível resolver o sorteio ponderado do evento.",
  );
}
