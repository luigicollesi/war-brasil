import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveMapHints,
  effectiveGameInteractionState,
  gameInteractionReducer,
  initialGameInteractionState,
} from "../.test-build/game-interaction.js";
import { buildGameViewModel } from "../.test-build/game-view-model.js";

function connection(territoryA, territoryB, passable = true, barrierName) {
  return {
    territoryA,
    territoryB,
    exists: true,
    passable,
    barrierName: passable ? barrierName ?? null : barrierName ?? "Barreira natural",
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

function targetKinds(hints) {
  return Object.fromEntries(
    hints.targets.map((target) => [target.territoryId, target.kind]),
  );
}

test("deriveMapHints expõe toda a cadeia própria normal A-B-C na manobra", () => {
  const gameSnapshot = snapshot({
    territories: [territory(1, "me", 6), territory(2), territory(3)],
    connections: [connection(1, 2), connection(2, 3)],
  });

  assert.deepEqual(targetKinds(hintsFor(gameSnapshot, 1)), {
    2: "normal",
    3: "normal",
  });
});

test("manobra destaca destinos cuja melhor rota atravessa exatamente uma barreira", () => {
  const gameSnapshot = snapshot({
    territories: [
      territory(1, "me", 6),
      territory(2),
      territory(3),
      territory(4),
      territory(5),
      territory(6),
    ],
    connections: [
      connection(1, 2),
      connection(2, 3),
      connection(3, 4, false, "Serra"),
      connection(4, 5),
      connection(5, 6, false, "Rio"),
    ],
  });

  const hints = hintsFor(gameSnapshot, 1);
  assert.deepEqual(targetKinds(hints), {
    2: "normal",
    3: "normal",
    4: "barrier-maneuver",
    5: "barrier-maneuver",
  });
  assert.equal(hints.targets.some((target) => target.territoryId === 6), false);
  assert.equal(
    hints.targets.find((target) => target.territoryId === 5)?.barrierName,
    "Serra",
  );
});

test("rota sem barreira sempre vence alternativa com barreira na manobra", () => {
  const gameSnapshot = snapshot({
    territories: [
      territory(1, "me", 6),
      territory(2),
      territory(3),
      territory(4),
      territory(5),
    ],
    connections: [
      connection(1, 2),
      connection(2, 5, false, "Atalho bloqueado"),
      connection(1, 3),
      connection(3, 4),
      connection(4, 5),
    ],
  });

  assert.equal(
    hintsFor(gameSnapshot, 1).targets.find((target) => target.territoryId === 5)
      ?.kind,
    "normal",
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

test("manobra por barreira permanece visível mas indisponível quando só uma tropa pode sair", () => {
  const gameSnapshot = snapshot({
    territories: [territory(1, "me", 2), territory(2)],
    connections: [connection(1, 2, false, "Serra")],
  });

  assert.deepEqual(hintsFor(gameSnapshot, 1).targets[0], {
    territoryId: 2,
    kind: "barrier-maneuver",
    selectable: false,
    barrierName: "Serra",
    troopLoss: 1,
    minimumTroops: 2,
  });
});

test("ataque mostra caveira em fronteira bloqueada e libera somente com quatro tropas", () => {
  const blocked = [connection(1, 2, false, "Serra")];
  const withThree = snapshot({
    phase: "attack",
    territories: [territory(1, "me", 3), territory(2, "enemy", 4)],
    connections: blocked,
  });
  const withFour = snapshot({
    phase: "attack",
    territories: [territory(1, "me", 4), territory(2, "enemy", 4)],
    connections: blocked,
  });

  assert.deepEqual(hintsFor(withThree, 1).targets[0], {
    territoryId: 2,
    kind: "barrier-attack",
    selectable: false,
    barrierName: "Serra",
    minimumTroops: 4,
  });
  assert.equal(hintsFor(withFour, 1).targets[0].selectable, true);
});

test("passagem normal paralela vence fronteira bloqueada no ataque", () => {
  const gameSnapshot = snapshot({
    phase: "attack",
    territories: [territory(1, "me", 4), territory(2, "enemy", 4)],
    connections: [
      connection(1, 2, false, "Barreira natural"),
      connection(1, 2, true, "Túnel Jurássico"),
    ],
  });

  assert.deepEqual(hintsFor(gameSnapshot, 1).targets, [
    { territoryId: 2, kind: "normal", selectable: true },
  ]);
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

test("reducer seleciona, desmarca, abre manobra com travessia e limpa o estado", () => {
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
    traversal: {
      kind: "barrier",
      troopLoss: 1,
      minimumTroops: 2,
      barrierName: "Serra",
    },
  });
  assert.deepEqual(state.dialog, {
    kind: "maneuver",
    sourceId: 1,
    targetId: 3,
    traversal: {
      kind: "barrier",
      troopLoss: 1,
      minimumTroops: 2,
      barrierName: "Serra",
    },
  });

  state = gameInteractionReducer(state, {
    type: "clear-selection",
    scopeKey,
  });
  assert.equal(state.sourceId, null);
  assert.equal(state.dialog, null);
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
      traversal: { kind: "normal", troopLoss: 0, minimumTroops: 1 },
    },
  );

  const reset = effectiveGameInteractionState(selected, "2:cards:enemy:-:-");

  assert.equal(reset.sourceId, null);
  assert.equal(reset.dialog, null);
});
