import assert from "node:assert/strict";
import test from "node:test";
import { applyGameCommandPatch } from "../.test-build/game-command-patch.js";
import {
  deriveMapHints,
  initialGameInteractionState,
} from "../.test-build/game-interaction.js";
import { hydrateGameSnapshot } from "../.test-build/game-snapshot-hydration.js";
import { shareGameSnapshot } from "../.test-build/game-snapshot-sharing.js";
import { buildGameViewModel } from "../.test-build/game-view-model.js";

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

function territory(territoryId, troops, movedInTurn = 0) {
  return {
    territoryId,
    ownerPlayerId: "me",
    ownerColor: "forest",
    troops,
    movedInTurn,
  };
}

function payload({
  tunnelDestination = null,
  territories = [],
  phase = "maneuver",
} = {}) {
  return {
    room: {
      id: "1",
      code: "TESTE",
      status: "playing",
      orderRollRound: 1,
      orderRollPlayerId: null,
      lastOrderRollPlayerId: null,
      phase,
      currentPlayerId: "me",
      turnNumber: 1,
      roundNumber: 1,
      jurassicTunnelDestinationId: tunnelDestination,
      reinforcementsRemaining: 0,
      winnerPlayerId: null,
      pendingConquest: null,
      battle: null,
    },
    players: [
      {
        id: "me",
        factionName: "Minha facção",
        color: "forest",
        turnPosition: 1,
        isMe: true,
        rolls: [],
      },
    ],
    territories,
    eligiblePlayerIds: [],
    myCards: [],
    myObjective: null,
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

test("hidratação troca túnel 20 por 31 sem contaminar a base cacheada", () => {
  const baseConnections = [connection(20, 21), connection(31, 32)];

  const first = hydrateGameSnapshot(
    payload({ tunnelDestination: 20 }),
    baseConnections,
  );
  const second = hydrateGameSnapshot(
    payload({ tunnelDestination: 31 }),
    baseConnections,
  );

  assert.equal(hasTunnelTo(first.connections, 20), true);
  assert.equal(hasTunnelTo(first.connections, 31), false);
  assert.equal(hasTunnelTo(second.connections, 20), false);
  assert.equal(hasTunnelTo(second.connections, 31), true);
  assert.equal(
    baseConnections.some((item) => item.barrierName === "Túnel Jurássico"),
    false,
  );
});

test("shareGameSnapshot preserva referência quando topologia efetiva não muda", () => {
  const baseConnections = [connection(20, 21)];
  const first = hydrateGameSnapshot(
    payload({ tunnelDestination: 20 }),
    baseConnections,
  );
  const equivalent = hydrateGameSnapshot(
    payload({ tunnelDestination: 20 }),
    baseConnections,
  );

  const shared = shareGameSnapshot(first, equivalent);

  assert.equal(shared.connections, first.connections);
  assert.equal(shared, first);
});

test("shareGameSnapshot troca referência quando destino jurássico muda", () => {
  const baseConnections = [connection(20, 21), connection(31, 32)];
  const first = hydrateGameSnapshot(
    payload({ tunnelDestination: 20 }),
    baseConnections,
  );
  const changed = hydrateGameSnapshot(
    payload({ tunnelDestination: 31 }),
    baseConnections,
  );

  const shared = shareGameSnapshot(first, changed);

  assert.notEqual(shared.connections, first.connections);
  assert.equal(hasTunnelTo(shared.connections, 31), true);
});

test("fluxo A-B-C destaca C e patch altera somente origem e destino", () => {
  const gameSnapshot = hydrateGameSnapshot(
    payload({
      territories: [territory(1, 6), territory(2, 2), territory(3, 3)],
    }),
    [connection(1, 2), connection(2, 3)],
  );
  const game = buildGameViewModel(gameSnapshot);
  const hints = deriveMapHints(gameSnapshot, game, {
    ...initialGameInteractionState("scope"),
    sourceId: 1,
  });

  assert.deepEqual(new Set(hints.targets), new Set([2, 3]));

  const middleBefore = gameSnapshot.territories[1];
  const patched = applyGameCommandPatch(gameSnapshot, {
    territories: [
      { territoryId: 1, troops: 3, movedInTurn: 0 },
      { territoryId: 3, troops: 6, movedInTurn: 3 },
    ],
  });

  assert.ok(patched);
  assert.equal(patched.territories[0].troops, 3);
  assert.equal(patched.territories[1].troops, 2);
  assert.equal(patched.territories[2].troops, 6);
  assert.equal(patched.territories[2].movedInTurn, 3);
  assert.equal(patched.territories[1], middleBefore);
});

test("command patch rejeita atualização de território inexistente", () => {
  const gameSnapshot = hydrateGameSnapshot(
    payload({ territories: [territory(1, 3)] }),
    [],
  );

  const patched = applyGameCommandPatch(gameSnapshot, {
    territories: [{ territoryId: 99, troops: 5 }],
  });

  assert.equal(patched, null);
});
