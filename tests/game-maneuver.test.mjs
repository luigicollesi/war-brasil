import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { maneuverTraversalProfile } from "../.test-build/game-barrier-rules.js";
import { maneuverMovableTroops } from "../.test-build/game-rules.js";
import { effectiveTerritoryConnections } from "../.test-build/territory-connections.js";
import {
  bestTerritoryRoute,
  bestTerritoryRoutes,
} from "../.test-build/territory-routing.js";

function connection(territoryA, territoryB, passable = true, barrierName) {
  return {
    territoryA,
    territoryB,
    exists: true,
    passable,
    barrierName: passable ? null : barrierName ?? "Barreira natural",
    description: null,
  };
}

function route(connections, sourceId, targetId, ownedIds) {
  return bestTerritoryRoute(connections, sourceId, targetId, ownedIds);
}

test("manobra A-B-C alcança C sem barreira através de B próprio", () => {
  const connections = [connection(1, 2), connection(2, 3)];
  const result = route(connections, 1, 3, [1, 2, 3]);

  assert.equal(result.kind, "reachable");
  assert.deepEqual(result.path, [1, 2, 3]);
  assert.equal(result.barrierCount, 0);
  assert.equal(maneuverTraversalProfile(result.barrierCount).kind, "normal");
});

test("território inimigo intermediário não pode servir de ponte na manobra", () => {
  const connections = [connection(1, 2), connection(2, 3)];
  const result = route(connections, 1, 3, [1, 3]);

  assert.deepEqual(result, { kind: "unreachable", territoryId: 3 });
});

test("uma barreira entre territórios próprios continua alcançável com penalidade", () => {
  const connections = [
    connection(1, 2),
    connection(2, 3, false, "Serra"),
  ];
  const result = route(connections, 1, 3, [1, 2, 3]);

  assert.equal(result.kind, "reachable");
  assert.equal(result.barrierCount, 1);
  assert.equal(result.barriers[0]?.barrierName, "Serra");
  assert.deepEqual(maneuverTraversalProfile(result.barrierCount), {
    kind: "barrier",
    barrierCount: 1,
    troopLoss: 1,
    minimumTroops: 2,
  });
});

test("duas barreiras na melhor rota classificam o destino como bloqueado", () => {
  const connections = [
    connection(1, 2, false, "Barreira A"),
    connection(2, 3),
    connection(3, 4, false, "Barreira B"),
  ];
  const result = route(connections, 1, 4, [1, 2, 3, 4]);

  assert.equal(result.kind, "reachable");
  assert.equal(result.barrierCount, 2);
  assert.equal(maneuverTraversalProfile(result.barrierCount).kind, "blocked");
});

test("rota sem barreira é priorizada mesmo quando existe atalho com barreira", () => {
  const connections = [
    connection(1, 2),
    connection(2, 3),
    connection(3, 4),
    connection(1, 4, false, "Atalho bloqueado"),
  ];
  const result = route(connections, 1, 4, [1, 2, 3, 4]);

  assert.equal(result.kind, "reachable");
  assert.equal(result.barrierCount, 0);
  assert.deepEqual(result.path, [1, 2, 3, 4]);
});

test("roteamento tolera ciclos, duplicatas e self-loop sem perder determinismo", () => {
  const connections = [
    connection(1, 2),
    connection(2, 3),
    connection(3, 1),
    connection(1, 2),
    connection(2, 2),
  ];

  const routes = bestTerritoryRoutes(connections, 1, [1, 2, 3]);
  assert.equal(routes.get(2)?.kind, "reachable");
  assert.equal(routes.get(3)?.kind, "reachable");
  assert.equal(routes.get(2)?.barrierCount, 0);
  assert.equal(routes.get(3)?.barrierCount, 0);
});

test("roteamento ignora conexões inexistentes mesmo se marcadas como passáveis", () => {
  const missingConnection = {
    ...connection(2, 3),
    exists: false,
  };
  const result = route(
    [connection(1, 2), missingConnection],
    1,
    3,
    [1, 2, 3],
  );

  assert.deepEqual(result, { kind: "unreachable", territoryId: 3 });
});

test("Túnel Jurássico funciona como aresta normal na melhor rota", () => {
  const baseConnections = [connection(20, 21), connection(21, 22)];
  const effectiveConnections = effectiveTerritoryConnections(
    baseConnections,
    20,
  );
  const result = route(
    effectiveConnections,
    3,
    22,
    [3, 20, 21, 22],
  );

  assert.equal(result.kind, "reachable");
  assert.equal(result.barrierCount, 0);
  assert.deepEqual(result.path, [3, 20, 21, 22]);
});

test("Túnel Jurássico vence uma fronteira base bloqueada para o mesmo par", () => {
  const blockedBase = [connection(3, 20, false), connection(20, 21)];
  const effectiveConnections = effectiveTerritoryConnections(blockedBase, 20);
  const result = route(effectiveConnections, 3, 21, [3, 20, 21]);

  assert.equal(result.kind, "reachable");
  assert.equal(result.barrierCount, 0);
  assert.deepEqual(result.path, [3, 20, 21]);
});

test("inimigo após o Túnel Jurássico impede usar o território como ponte", () => {
  const baseConnections = [connection(20, 21), connection(21, 22)];
  const effectiveConnections = effectiveTerritoryConnections(
    baseConnections,
    20,
  );
  const result = route(effectiveConnections, 3, 22, [3, 20, 22]);

  assert.deepEqual(result, { kind: "unreachable", territoryId: 22 });
});

test("quantidade movimentável preserva uma tropa e bloqueia tropas recém-movidas", () => {
  assert.equal(maneuverMovableTroops(8, 3), 4);
  assert.equal(maneuverMovableTroops(2, 0), 1);
  assert.equal(maneuverMovableTroops(1, 0), 0);
  assert.equal(maneuverMovableTroops(5, 4), 0);
  assert.equal(maneuverMovableTroops(3, 5), 0);
});

test("fluxo de manobra limpa a seleção depois de uma ação bem-sucedida", () => {
  const panel = readFileSync("src/components/game-turn-panel.tsx", "utf8");

  assert.match(
    panel,
    /action\("maneuver",[\s\S]*?if \(success\) interaction\.clearSelection\(\)/,
  );
});

test("backend recalcula topologia efetiva e melhor rota própria antes de mover tropas", () => {
  const source = readFileSync(
    "src/lib/game-maneuver-command-service.ts",
    "utf8",
  );

  assert.match(source, /getEffectiveGameTopology/);
  assert.match(source, /topology\.connections/);
  assert.match(source, /bestTerritoryRoute\(/);
  assert.match(source, /owned\.map\(\(territory\) => territory\.territory_id\)/);
  assert.match(source, /maneuverTraversalProfile\(route\.barrierCount\)/);
  assert.match(source, /maneuverMovableTroops\(/);
  assert.match(
    source,
    /const troopsArriving = input\.troops - traversal\.troopLoss/,
  );
  assert.doesNotMatch(source, /getBaseTerritoryConnections/);
  assert.doesNotMatch(source, /effectiveTerritoryConnections\(/);
  assert.doesNotMatch(source, /getPassableTerritoryConnections/);
  assert.doesNotMatch(source, /reachableTerritoryIds/);
  assert.doesNotMatch(source, /FROM territory_connections/);
});
