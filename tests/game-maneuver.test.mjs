import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { maneuverMovableTroops } from "../.test-build/game-rules.js";
import {
  effectiveTerritoryConnections,
  reachableTerritoryIds,
} from "../.test-build/territory-connections.js";

function connection(territoryA, territoryB, passable = true) {
  return {
    territoryA,
    territoryB,
    exists: true,
    passable,
    barrierName: passable ? null : "Barreira natural",
    description: null,
  };
}

function maneuverTargets(connections, sourceId, ownedIds) {
  return reachableTerritoryIds(connections, sourceId, ownedIds).filter(
    (territoryId) => territoryId !== sourceId,
  );
}

test("manobra A-B-C permite alcançar C através de B próprio", () => {
  const connections = [connection(1, 2), connection(2, 3)];

  assert.deepEqual(
    new Set(maneuverTargets(connections, 1, [1, 2, 3])),
    new Set([2, 3]),
  );
});

test("território inimigo intermediário bloqueia propagação da manobra", () => {
  const connections = [connection(1, 2), connection(2, 3)];

  assert.deepEqual(maneuverTargets(connections, 1, [1, 3]), []);
});

test("barreira intransponível interrompe a cadeia mesmo entre territórios próprios", () => {
  const connections = [connection(1, 2), connection(2, 3, false)];

  assert.deepEqual(
    maneuverTargets(connections, 1, [1, 2, 3]),
    [2],
  );
});

test("BFS de manobra tolera ciclos, duplicatas e self-loop sem repetir destinos", () => {
  const connections = [
    connection(1, 2),
    connection(2, 3),
    connection(3, 1),
    connection(1, 2),
    connection(2, 2),
  ];

  const targets = maneuverTargets(connections, 1, [1, 2, 3]);

  assert.deepEqual(new Set(targets), new Set([2, 3]));
  assert.equal(targets.length, 2);
});

test("BFS ignora conexões inexistentes mesmo se marcadas como passáveis", () => {
  const missingConnection = {
    ...connection(2, 3),
    exists: false,
  };
  const connections = [connection(1, 2), missingConnection];

  assert.deepEqual(
    maneuverTargets(connections, 1, [1, 2, 3]),
    [2],
  );
});

test("Túnel Jurássico funciona como aresta normal na cadeia de manobra", () => {
  const baseConnections = [connection(20, 21), connection(21, 22)];
  const effectiveConnections = effectiveTerritoryConnections(
    baseConnections,
    20,
  );

  assert.deepEqual(
    new Set(maneuverTargets(effectiveConnections, 3, [3, 20, 21, 22])),
    new Set([20, 21, 22]),
  );
});

test("Túnel Jurássico vence uma fronteira normal bloqueada para o mesmo par", () => {
  const blockedBase = [connection(3, 20, false), connection(20, 21)];
  const effectiveConnections = effectiveTerritoryConnections(blockedBase, 20);

  assert.deepEqual(
    new Set(maneuverTargets(effectiveConnections, 3, [3, 20, 21])),
    new Set([20, 21]),
  );
});

test("inimigo após o Túnel Jurássico impede alcançar territórios próprios além dele", () => {
  const baseConnections = [connection(20, 21), connection(21, 22)];
  const effectiveConnections = effectiveTerritoryConnections(
    baseConnections,
    20,
  );

  assert.deepEqual(
    maneuverTargets(effectiveConnections, 3, [3, 20, 22]),
    [20],
  );
});

test("quantidade movimentável preserva uma tropa e bloqueia tropas recém-movidas", () => {
  assert.equal(maneuverMovableTroops(8, 3), 4);
  assert.equal(maneuverMovableTroops(2, 0), 1);
  assert.equal(maneuverMovableTroops(1, 0), 0);
  assert.equal(maneuverMovableTroops(5, 4), 0);
  assert.equal(maneuverMovableTroops(3, 5), 0);
});

test("camada de interação deriva alvos por BFS e abre manobra somente para alvo alcançável", () => {
  const interaction = readFileSync("src/lib/game-interaction.ts", "utf8");
  const hook = readFileSync("src/hooks/use-game-interaction.ts", "utf8");

  assert.match(interaction, /reachableTerritoryIds\(/);
  assert.match(interaction, /filter\(\(territoryId\) => territoryId !== sourceId\)/);
  assert.match(interaction, /targets: maneuverTargetIds\(snapshot, game, state\.sourceId\)/);
  assert.match(hook, /const targets = maneuverTargetIds\(snapshot, game, state\.sourceId\)/);
  assert.match(hook, /targets\.includes\(territoryId\)/);
  assert.match(hook, /type: "open-maneuver"/);
  assert.match(hook, /maneuverMovableTroops\(/);
});

test("modal usa o mesmo limite e limpa a seleção após uma manobra bem-sucedida", () => {
  const panel = readFileSync("src/components/game-turn-panel.tsx", "utf8");

  assert.match(
    panel,
    /selectedSource\.troops - selectedSource\.movedInTurn - 1/,
  );
  assert.match(
    panel,
    /action\("maneuver",[\s\S]*?if \(success\) interaction\.clearSelection\(\)/,
  );
});

test("backend recalcula topologia efetiva e caminho próprio antes de mover tropas", () => {
  const source = readFileSync(
    "src/lib/game-maneuver-command-service.ts",
    "utf8",
  );

  assert.match(source, /getPassableTerritoryConnections/);
  assert.match(source, /effectiveTerritoryConnections\(/);
  assert.match(source, /reachableTerritoryIds\(/);
  assert.match(source, /owned\.map\(\(territory\) => territory\.territory_id\)/);
  assert.match(source, /if \(!reachable\.has\(to\)\)/);
  assert.match(source, /maneuverMovableTroops\(/);
});
