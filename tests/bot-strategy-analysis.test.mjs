import assert from "node:assert/strict";
import test from "node:test";
import {
  buildObjectivePlan,
  evaluateObjectiveProgress,
} from "../.test-build/bots/bot-objective-plan.js";
import { forecastConquest } from "../.test-build/bots/bot-combat-odds.js";
import {
  articulationPoints,
  bestStrategicRoute,
} from "../.test-build/bots/bot-routing.js";
import { defenseTarget } from "../.test-build/bots/bot-defense.js";

function connection(territoryA, territoryB, passable = true) {
  return {
    territoryA,
    territoryB,
    exists: true,
    passable,
    barrierName: passable ? null : "Barreira",
    description: null,
  };
}

function state(overrides = {}) {
  return {
    room: {
      id: "1",
      phase: "reinforcement",
      roundNumber: 1,
      reinforcementsRemaining: 3,
    },
    bot: { id: "10", cardTradeCount: 0 },
    objective: {
      type: "territories",
      params: { territories: 3 },
      targetPlayerId: null,
    },
    cards: [],
    players: [
      { id: "10", turnPosition: 1, isBot: true },
      { id: "20", turnPosition: 2, isBot: false },
    ],
    territories: [
      { territoryId: 1, ownerPlayerId: "10", troops: 4, movedInTurn: 0 },
      { territoryId: 2, ownerPlayerId: "10", troops: 2, movedInTurn: 0 },
      { territoryId: 3, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
      { territoryId: 4, ownerPlayerId: "20", troops: 6, movedInTurn: 0 },
    ],
    topology: {
      connections: [connection(1, 3), connection(2, 4)],
      eventId: 0,
      resolvedEventEffects: [],
    },
    ...overrides,
  };
}

test("objetivos são traduzidos apenas por type e parâmetros resolvidos", () => {
  assert.deepEqual(buildObjectivePlan(state()), {
    kind: "territories",
    territoryCount: 3,
  });

  assert.deepEqual(
    buildObjectivePlan(
      state({
        objective: {
          type: "fortification",
          params: { territories: 2, minTroops: 4 },
          targetPlayerId: null,
        },
      }),
    ),
    { kind: "fortification", territoryCount: 2, minimumTroops: 4 },
  );

  assert.deepEqual(
    buildObjectivePlan(
      state({
        objective: {
          type: "elimination",
          params: { territories: 12 },
          targetPlayerId: "20",
        },
      }),
    ),
    { kind: "elimination", targetPlayerId: "20", territoryFloor: 12 },
  );
});

test("fortification distingue expansão de consolidação e protege territórios qualificados", () => {
  const strategicState = state({
    objective: {
      type: "fortification",
      params: { territories: 2, minTroops: 4 },
      targetPlayerId: null,
    },
  });
  const plan = buildObjectivePlan(strategicState);
  const progress = evaluateObjectiveProgress(strategicState, plan);

  assert.equal(progress.missingTerritories, 0);
  assert.deepEqual(progress.protectedTerritories, [1]);
  assert.equal(progress.ratio, 0.5);
});

test("forecast de combate melhora com mais tropas atacantes", () => {
  const weaker = forecastConquest(4, 3, "normal");
  const stronger = forecastConquest(8, 3, "normal");
  assert.ok(stronger.conquestProbability > weaker.conquestProbability);
  assert.ok(stronger.conquestProbability > 0 && stronger.conquestProbability <= 1);
});

test("barreira é matematicamente mais custosa que a mesma batalha normal", () => {
  const normal = forecastConquest(10, 3, "normal");
  const barrier = forecastConquest(10, 3, "barrier");
  assert.ok(barrier.conquestProbability < normal.conquestProbability);
  assert.ok(barrier.expectedAttackerLosses > 0);
});

test("roteamento estratégico prefere inimigo fraco a inimigo forte", () => {
  const route = bestStrategicRoute({
    connections: [connection(1, 2), connection(2, 4), connection(1, 3), connection(3, 4)],
    territories: [
      { territoryId: 1, ownerPlayerId: "10", troops: 5, movedInTurn: 0 },
      { territoryId: 2, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
      { territoryId: 3, ownerPlayerId: "20", troops: 8, movedInTurn: 0 },
      { territoryId: 4, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
    ],
    playerId: "10",
    targetTerritoryIds: [4],
  });

  assert.equal(route.kind, "reachable");
  assert.deepEqual(route.path, [1, 2, 4]);
});

test("pontos de articulação identificam gargalos próprios", () => {
  const points = articulationPoints(
    [connection(1, 2), connection(2, 3), connection(2, 4)],
    [1, 2, 3, 4],
  );
  assert.deepEqual([...points], [2]);
});

test("defesa de território protegido por fortification respeita mínimo do objetivo", () => {
  const strategicState = state({
    objective: {
      type: "fortification",
      params: { territories: 1, minTroops: 4 },
      targetPlayerId: null,
    },
  });
  const plan = buildObjectivePlan(strategicState);
  const progress = evaluateObjectiveProgress(strategicState, plan);
  const target = defenseTarget({
    state: strategicState,
    territory: strategicState.territories[0],
    plan,
    progress,
  });
  assert.ok(target >= 4);
});
