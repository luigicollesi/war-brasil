import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  effectiveTerritoryConnections,
} from "../.test-build/territory-connections.js";

function connection(territoryA, territoryB) {
  return {
    territoryA,
    territoryB,
    exists: true,
    passable: true,
    barrierName: null,
    description: null,
  };
}

function hasTunnelTo(connections, destinationTerritoryId) {
  return connections.some(
    (item) =>
      item.barrierName === "Túnel Jurássico" &&
      ((item.territoryA === 3 && item.territoryB === destinationTerritoryId) ||
        (item.territoryB === 3 && item.territoryA === destinationTerritoryId)),
  );
}

test("topologia efetiva adiciona o túnel sem mutar a topologia base", () => {
  const baseConnections = [connection(20, 21), connection(31, 32)];
  const originalBase = structuredClone(baseConnections);

  const effectiveConnections = effectiveTerritoryConnections(
    baseConnections,
    20,
  );

  assert.deepEqual(baseConnections, originalBase);
  assert.notEqual(effectiveConnections, baseConnections);
  assert.equal(effectiveConnections.length, baseConnections.length + 1);
  assert.equal(hasTunnelTo(effectiveConnections, 20), true);
  assert.equal(
    baseConnections.some((item) => item.barrierName === "Túnel Jurássico"),
    false,
  );
});

test("troca de rodada substitui o túnel usando a mesma base cacheada", () => {
  const baseConnections = [connection(20, 21), connection(31, 32)];

  const firstRound = effectiveTerritoryConnections(baseConnections, 20);
  const secondRound = effectiveTerritoryConnections(baseConnections, 31);

  assert.equal(hasTunnelTo(firstRound, 20), true);
  assert.equal(hasTunnelTo(firstRound, 31), false);
  assert.equal(hasTunnelTo(secondRound, 20), false);
  assert.equal(hasTunnelTo(secondRound, 31), true);
  assert.equal(
    baseConnections.some((item) => item.barrierName === "Túnel Jurássico"),
    false,
  );
});

test("sem destino jurássico a topologia efetiva contém somente a base", () => {
  const baseConnections = [connection(1, 3), connection(20, 21)];
  const effectiveConnections = effectiveTerritoryConnections(
    baseConnections,
    null,
  );

  assert.deepEqual(effectiveConnections, baseConnections);
  assert.notEqual(effectiveConnections, baseConnections);
});

test("snapshot transporta somente a topologia base", () => {
  const source = readFileSync("src/lib/game-snapshot-service.ts", "utf8");

  assert.match(source, /getBaseTerritoryConnections/);
  assert.match(source, /jurassicTunnelDestinationId: room\.jurassic_tunnel_territory_id/);
  assert.doesNotMatch(source, /jurassicTunnelConnection/);
  assert.doesNotMatch(source, /connections\.push\(tunnelConnection\)/);
});

test("cliente cacheia base e hidrata o túnel a partir do snapshot atual", () => {
  const sync = readFileSync("src/hooks/use-game-sync.ts", "utf8");
  const hydration = readFileSync(
    "src/lib/game-snapshot-hydration.ts",
    "utf8",
  );

  assert.match(sync, /baseTopologyConnectionsRef/);
  assert.match(
    sync,
    /payload\.connections \?\? baseTopologyConnectionsRef\.current/,
  );
  assert.match(sync, /hydrateGameSnapshot\(payload, baseConnections\)/);
  assert.doesNotMatch(sync, /topologyConnectionsRef/);
  assert.match(hydration, /effectiveTerritoryConnections\(/);
  assert.match(hydration, /payload\.room\.jurassicTunnelDestinationId/);
});

test("contrato de topologia v2 invalida caches do formato anterior", () => {
  const contract = readFileSync("src/lib/game-sync-contract.ts", "utf8");
  const route = readFileSync(
    "src/app/api/games/[roomId]/route.ts",
    "utf8",
  );

  assert.match(contract, /GAME_TOPOLOGY_VERSION = "2"/);
  assert.match(route, /knownTopology === GAME_TOPOLOGY_VERSION/);
  assert.match(route, /delete dynamicSnapshot\.connections/);
});
