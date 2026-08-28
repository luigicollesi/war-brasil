import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_CONNECTION_COUNT,
  EVENT_COUNT,
  assertEventCatalogShape,
} from "../.test-build/events/event-catalog.js";
import {
  EVENT_HISTORY_SIZE,
  eligibleEventConnections,
  selectWeightedEvent,
  totalEventWeight,
} from "../.test-build/events/event-selector.js";
import {
  EventConfigurationError,
  parseEventEffects,
} from "../.test-build/events/event-types.js";

const weightedConnections = [
  { fromEvent: 10, toEvent: 20, weight: 4 },
  { fromEvent: 10, toEvent: 30, weight: 4 },
  { fromEvent: 10, toEvent: 40, weight: 2 },
  { fromEvent: 10, toEvent: 50, weight: 2 },
  { fromEvent: 10, toEvent: 60, weight: 1 },
];

function validCatalogGraph() {
  const eventIds = Array.from({ length: 38 }, (_, index) => index);
  const connections = [];

  for (let destination = 1; destination <= 10; destination += 1) {
    connections.push({ fromEvent: 0, toEvent: destination, weight: 1 });
  }

  const weights = [4, 4, 2, 2, 1];
  for (let fromEvent = 1; fromEvent <= 37; fromEvent += 1) {
    for (let offset = 1; offset <= 5; offset += 1) {
      const toEvent = ((fromEvent - 1 + offset) % 37) + 1;
      connections.push({
        fromEvent,
        toEvent,
        weight: weights[offset - 1],
      });
    }
  }

  return { eventIds, connections };
}

test("sorteio ponderado respeita exatamente os intervalos dos pesos", () => {
  assert.equal(totalEventWeight(weightedConnections), 13);

  const expected = [20, 20, 20, 20, 30, 30, 30, 30, 40, 40, 50, 50, 60];
  const selected = expected.map((_, ticket) =>
    selectWeightedEvent(weightedConnections, ticket).toEvent,
  );

  assert.deepEqual(selected, expected);
});

test("histórico exclui os últimos quatro eventos antes do sorteio", () => {
  assert.equal(EVENT_HISTORY_SIZE, 4);

  const candidates = eligibleEventConnections(weightedConnections, [20, 30, 40, 50]);
  assert.deepEqual(candidates.map((connection) => connection.toEvent), [60]);
});

test("eventos mais antigos que a janela de histórico voltam a ser elegíveis", () => {
  const candidates = eligibleEventConnections(weightedConnections, [20, 30, 40, 50, 60]);
  assert.deepEqual(candidates.map((connection) => connection.toEvent), [60]);
});

test("selector libera todas as saídas quando o histórico eliminaria o grafo inteiro", () => {
  const connections = [
    { fromEvent: 10, toEvent: 20, weight: 4 },
    { fromEvent: 10, toEvent: 30, weight: 1 },
  ];

  assert.deepEqual(
    eligibleEventConnections(connections, [20, 30]).map((connection) => connection.toEvent),
    [20, 30],
  );
});

test("evento zero pode ser origem, mas nunca destino", () => {
  assert.deepEqual(
    eligibleEventConnections(
      [
        { fromEvent: 0, toEvent: 10, weight: 2 },
        { fromEvent: 0, toEvent: 20, weight: 1 },
      ],
      [0],
    ).map((connection) => connection.toEvent),
    [10, 20],
  );

  assert.throws(
    () =>
      eligibleEventConnections(
        [{ fromEvent: 10, toEvent: 0, weight: 1 }],
        [],
      ),
    EventConfigurationError,
  );
});

test("self-loop é rejeitado mesmo quando o histórico exigiria fallback", () => {
  assert.throws(
    () =>
      eligibleEventConnections(
        [{ fromEvent: 10, toEvent: 10, weight: 1 }],
        [10],
      ),
    EventConfigurationError,
  );
});

test("configuração inválida falha em vez de distorcer o sorteio", () => {
  assert.throws(() => totalEventWeight([]), EventConfigurationError);
  assert.throws(
    () => totalEventWeight([{ fromEvent: 1, toEvent: 2, weight: 0 }]),
    EventConfigurationError,
  );
  assert.throws(
    () => selectWeightedEvent([{ fromEvent: 1, toEvent: 2, weight: 1 }], 1),
    EventConfigurationError,
  );
  assert.throws(
    () =>
      eligibleEventConnections(
        [
          { fromEvent: 1, toEvent: 2, weight: 1 },
          { fromEvent: 3, toEvent: 4, weight: 1 },
        ],
        [],
      ),
    EventConfigurationError,
  );
});

test("contrato do catálogo aceita exatamente 38 eventos e 195 conexões válidas", () => {
  const catalog = validCatalogGraph();
  assert.equal(catalog.eventIds.length, EVENT_COUNT);
  assert.equal(catalog.connections.length, EVENT_CONNECTION_COUNT);
  assert.doesNotThrow(() =>
    assertEventCatalogShape(catalog.eventIds, catalog.connections),
  );
});

test("contrato do catálogo detecta catálogo incompleto e grafo inválido", () => {
  const catalog = validCatalogGraph();

  assert.throws(
    () => assertEventCatalogShape(catalog.eventIds.slice(0, -1), catalog.connections),
    EventConfigurationError,
  );
  assert.throws(
    () => assertEventCatalogShape(catalog.eventIds, catalog.connections.slice(0, -1)),
    EventConfigurationError,
  );

  const withInitialDestination = catalog.connections.map((connection, index) =>
    index === 0 ? { ...connection, toEvent: 0 } : connection,
  );
  assert.throws(
    () => assertEventCatalogShape(catalog.eventIds, withInitialDestination),
    EventConfigurationError,
  );
});

test("efeitos JSONB são validados na fronteira do domínio", () => {
  const effects = parseEventEffects([
    { type: "ADD_TROOPS", territories: [1, 2], amount: 1 },
    { type: "REMOVE_TROOPS", territories: [3], amount: 2 },
    { type: "BLOCK_ATTACK", territories: [4, 5] },
    { type: "OPEN_CONNECTIONS", connections: [[1, 2]] },
    { type: "BLOCK_CONNECTIONS", connections: [[2, 3]] },
    { type: "RANDOM_OPEN_CONNECTIONS", count: 1 },
    { type: "RANDOM_BLOCK_CONNECTIONS", count: 2 },
    { type: "RANDOM_TOGGLE_CONNECTIONS", count: 1 },
  ]);

  assert.equal(effects.length, 8);
  assert.equal(effects[7].type, "RANDOM_TOGGLE_CONNECTIONS");

  assert.throws(
    () => parseEventEffects([{ type: "UNKNOWN" }]),
    EventConfigurationError,
  );
  assert.throws(
    () => parseEventEffects([{ type: "ADD_TROOPS", territories: [43], amount: 1 }]),
    EventConfigurationError,
  );
});
