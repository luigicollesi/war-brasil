import assert from "node:assert/strict";
import test from "node:test";
import {
  bestTerritoryRoute,
  bestTerritoryRoutes,
} from "../.test-build/territory-routing.js";
import { jurassicTunnelConnection } from "../.test-build/territory-connections.js";

function connection(territoryA, territoryB, passable = true, barrierName = null) {
  return {
    territoryA,
    territoryB,
    exists: true,
    passable,
    barrierName,
    description: null,
  };
}

test("roteamento calcula o mínimo de barreiras no cenário A-B-C-X-D-E-X-F", () => {
  const connections = [
    connection(1, 2),
    connection(2, 3),
    connection(3, 4, false, "Barreira 1"),
    connection(4, 5),
    connection(5, 6, false, "Barreira 2"),
  ];
  const routes = bestTerritoryRoutes(connections, 1, [1, 2, 3, 4, 5, 6]);

  assert.equal(routes.get(1).barrierCount, 0);
  assert.equal(routes.get(2).barrierCount, 0);
  assert.equal(routes.get(3).barrierCount, 0);
  assert.equal(routes.get(4).barrierCount, 1);
  assert.equal(routes.get(5).barrierCount, 1);
  assert.equal(routes.get(6).barrierCount, 2);
});

test("rota sem barreira sempre vence atalho com barreira", () => {
  const connections = [
    connection(1, 2),
    connection(2, 3),
    connection(3, 4),
    connection(4, 5),
    connection(1, 5, false, "Atalho bloqueado"),
  ];
  const route = bestTerritoryRoute(connections, 1, 5, [1, 2, 3, 4, 5]);

  assert.equal(route.kind, "reachable");
  assert.equal(route.barrierCount, 0);
  assert.deepEqual(route.path, [1, 2, 3, 4, 5]);
});

test("com mesmo número de barreiras vence a rota com menos passos", () => {
  const connections = [
    connection(1, 2, false, "Curta"),
    connection(2, 5),
    connection(1, 3),
    connection(3, 4),
    connection(4, 5, false, "Longa"),
  ];
  const route = bestTerritoryRoute(connections, 1, 5, [1, 2, 3, 4, 5]);

  assert.equal(route.kind, "reachable");
  assert.equal(route.barrierCount, 1);
  assert.equal(route.steps, 2);
  assert.deepEqual(route.path, [1, 2, 5]);
  assert.equal(route.barriers[0].barrierName, "Curta");
});

test("empates completos são determinísticos pelo menor território intermediário", () => {
  const connections = [
    connection(1, 3),
    connection(3, 4),
    connection(1, 2),
    connection(2, 4),
  ];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const route = bestTerritoryRoute(connections, 1, 4, [1, 2, 3, 4]);
    assert.deepEqual(route.path, [1, 2, 4]);
  }
});

test("território fora do conjunto permitido nunca é usado como ponte", () => {
  const connections = [connection(1, 2), connection(2, 3)];
  const route = bestTerritoryRoute(connections, 1, 3, [1, 3]);

  assert.deepEqual(route, { kind: "unreachable", territoryId: 3 });
});

test("rota alternativa passável remove a penalidade de barreira", () => {
  const connections = [
    connection(1, 2),
    connection(2, 3),
    connection(3, 4, false, "Barreira"),
    connection(4, 5),
    connection(3, 7),
    connection(7, 5),
  ];
  const route = bestTerritoryRoute(connections, 1, 5, [1, 2, 3, 4, 5, 7]);

  assert.equal(route.kind, "reachable");
  assert.equal(route.barrierCount, 0);
  assert.deepEqual(route.path, [1, 2, 3, 7, 5]);
});

test("Túnel Jurássico passável vence conexão bloqueada paralela", () => {
  const tunnel = jurassicTunnelConnection(20);
  assert.ok(tunnel);
  const route = bestTerritoryRoute(
    [connection(3, 20, false, "Barreira natural"), tunnel],
    3,
    20,
    [3, 20],
  );

  assert.equal(route.kind, "reachable");
  assert.equal(route.barrierCount, 0);
  assert.equal(route.barriers.length, 0);
  assert.deepEqual(route.path, [3, 20]);
});
