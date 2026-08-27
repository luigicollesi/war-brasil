import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveMapHints,
  effectiveGameInteractionState,
  gameInteractionReducer,
  initialGameInteractionState,
} from "../.test-build/game-interaction.js";
import { buildGameViewModel } from "../.test-build/game-view-model.js";

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

function territory(
  territoryId,
  ownerPlayerId = "me",
  troops = 3,
  movedInTurn = 0,
) {
  return {
    territoryId,
    ownerPlayerId,
    ownerColor: ownerPlayerId === "me" ? "forest" : "ocean",
    troops,
    movedInTurn,
  };
}

function snapshot({
  territories,
  connections,
  phase = "maneuver",
  currentPlayerId = "me",
  battle = null,
  turnNumber = 1,
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
      currentPlayerId,
      turnNumber,
      roundNumber: 1,
      jurassicTunnelDestinationId: null,
      reinforcementsRemaining: 0,
      winnerPlayerId: null,
      pendingConquest: null,
      battle,
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
      {
        id: "enemy",
        factionName: "Rival",
        color: "ocean",
        turnPosition: 2,
        isMe: false,
        rolls: [],
      },
    ],
    territories: territories ?? [],
    eligiblePlayerIds: [],
    connections: connections ?? [],
    myCards: [],
    myObjective: null,
  };
}

function hintsFor(gameSnapshot, sourceId = null) {
  const game = buildGameViewModel(gameSnapshot);
  return deriveMapHints(gameSnapshot, game, {
    ...initialGameInteractionState("scope"),
    sourceId,
  });
}

test("deriveMapHints expõe toda a cadeia própria A-B-C na manobra", () => {
  const gameSnapshot = snapshot({
    territories: [territory(1, "me", 6), territory(2), territory(3)],
    connections: [connection(1, 2), connection(2, 3)],
  });

  assert.deepEqual(
    new Set(hintsFor(gameSnapshot, 1).targets),
    new Set([2, 3]),
  );
});

test("deriveMapHints não atravessa território inimigo intermediário", () => {
  const gameSnapshot = snapshot({
    territories: [
      territory(1, "me", 6),
      territory(2, "enemy"),
      territory(3, "me"),
    ],
    connections: [connection(1, 2), connection(2, 3)],
  });

  assert.deepEqual(hintsFor(gameSnapshot, 1).targets, []);
});

test("origens disponíveis respeitam tropas móveis e movedInTurn", () => {
  const gameSnapshot = snapshot({
    territories: [
      territory(1, "me", 1, 0),
      territory(2, "me", 5, 4),
      territory(3, "me", 5, 3),
      territory(4, "enemy", 8, 0),
    ],
    connections: [],
  });

  assert.deepEqual(hintsFor(gameSnapshot).available, [3]);
});

test("mapa não oferece ações fora do turno ou durante batalha", () => {
  const base = {
    territories: [territory(1, "me", 6), territory(2)],
    connections: [connection(1, 2)],
  };

  assert.deepEqual(
    hintsFor(snapshot({ ...base, currentPlayerId: "enemy" }), 1),
    { available: [], targets: [] },
  );

  assert.deepEqual(
    hintsFor(snapshot({ ...base, battle: { stage: "awaiting_attacker_roll" } }), 1),
    { available: [], targets: [] },
  );
});

test("reducer seleciona, desmarca, abre manobra e limpa o estado", () => {
  const scopeKey = "1:maneuver:me:-:-";
  let state = initialGameInteractionState(scopeKey);

  state = gameInteractionReducer(state, {
    type: "select-source",
    scopeKey,
    territoryId: 1,
  });
  assert.equal(state.sourceId, 1);

  state = gameInteractionReducer(state, {
    type: "select-source",
    scopeKey,
    territoryId: 1,
  });
  assert.equal(state.sourceId, null);

  state = gameInteractionReducer(state, {
    type: "open-maneuver",
    scopeKey,
    sourceId: 1,
    targetId: 3,
  });
  assert.deepEqual(state.dialog, {
    kind: "maneuver",
    sourceId: 1,
    targetId: 3,
  });

  state = gameInteractionReducer(state, {
    type: "clear-selection",
    scopeKey,
  });
  assert.equal(state.sourceId, null);
  assert.equal(state.dialog, null);
  assert.equal(state.barrier, null);
});

test("mudança de scope invalida seleção e diálogo antigos", () => {
  const oldScope = "1:maneuver:me:-:-";
  const selected = gameInteractionReducer(
    initialGameInteractionState(oldScope),
    {
      type: "open-maneuver",
      scopeKey: oldScope,
      sourceId: 1,
      targetId: 3,
    },
  );

  const reset = effectiveGameInteractionState(
    selected,
    "2:cards:enemy:-:-",
  );

  assert.equal(reset.sourceId, null);
  assert.equal(reset.dialog, null);
  assert.equal(reset.barrier, null);
});
