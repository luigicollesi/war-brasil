import assert from "node:assert/strict";
import test from "node:test";
import { buildObjectivePlan, evaluateObjectiveProgress } from "../.test-build/bots/bot-objective-plan.js";
import { territoryStrategicValues } from "../.test-build/bots/bot-territory-value.js";
import { chooseAttack } from "../.test-build/bots/bot-attack.js";
import { chooseConquestTransfer } from "../.test-build/bots/bot-conquest.js";
import { chooseManeuver } from "../.test-build/bots/bot-maneuver.js";

function connection(territoryA, territoryB, passable = true, barrierName = null) {
  return { territoryA, territoryB, exists: true, passable, barrierName, description: null };
}

function state(overrides = {}) {
  return {
    room: { id: "1", phase: "attack", roundNumber: 1, reinforcementsRemaining: 0 },
    bot: { id: "10", cardTradeCount: 0 },
    objective: { type: "territories", params: { territories: 3 }, targetPlayerId: null },
    cards: [],
    players: [
      { id: "10", turnPosition: 1, isBot: true },
      { id: "20", turnPosition: 2, isBot: false },
    ],
    territories: [
      { territoryId: 1, ownerPlayerId: "10", troops: 8, movedInTurn: 0 },
      { territoryId: 2, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
      { territoryId: 3, ownerPlayerId: "20", troops: 6, movedInTurn: 0 },
    ],
    topology: {
      connections: [connection(1, 2), connection(1, 3)],
      eventId: 0,
      resolvedEventEffects: [],
    },
    ...overrides,
  };
}

function analysis(strategicState) {
  const plan = buildObjectivePlan(strategicState);
  const progress = evaluateObjectiveProgress(strategicState, plan);
  const values = territoryStrategicValues(strategicState, plan, progress);
  return { plan, progress, values };
}

test("ataque escolhe conquista barata e evita alvo muito mais caro", () => {
  const strategicState = state();
  const { plan, progress, values } = analysis(strategicState);
  assert.deepEqual(chooseAttack(strategicState, plan, progress, values), {
    type: "attack",
    fromTerritoryId: 1,
    toTerritoryId: 2,
  });
});

test("origem bloqueada por evento nunca inicia ataque", () => {
  const strategicState = state({
    topology: {
      connections: [connection(1, 2)],
      eventId: 9,
      resolvedEventEffects: [{ type: "BLOCK_ATTACK", territories: [1] }],
    },
  });
  const { plan, progress, values } = analysis(strategicState);
  assert.deepEqual(chooseAttack(strategicState, plan, progress, values), {
    type: "finish_attack",
  });
});

test("ataque normal vence alternativa equivalente por barreira", () => {
  const strategicState = state({
    territories: [
      { territoryId: 1, ownerPlayerId: "10", troops: 10, movedInTurn: 0 },
      { territoryId: 2, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
      { territoryId: 3, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
    ],
    topology: {
      connections: [connection(1, 2), connection(1, 3, false, "Serra")],
      eventId: 0,
      resolvedEventEffects: [],
    },
  });
  const { plan, progress, values } = analysis(strategicState);
  assert.deepEqual(chooseAttack(strategicState, plan, progress, values), {
    type: "attack",
    fromTerritoryId: 1,
    toTerritoryId: 2,
  });
});

test("conquista preserva reserva na origem e move tropas para o novo território", () => {
  const strategicState = state({
    territories: [
      { territoryId: 1, ownerPlayerId: "10", troops: 7, movedInTurn: 0 },
      { territoryId: 2, ownerPlayerId: "10", troops: 1, movedInTurn: 0 },
      { territoryId: 3, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
    ],
    topology: {
      connections: [connection(1, 2), connection(2, 3)],
      eventId: 0,
      resolvedEventEffects: [],
    },
  });
  const { plan, progress, values } = analysis(strategicState);
  const action = chooseConquestTransfer(strategicState, plan, progress, values, 1, 2);
  assert.equal(action.type, "complete_conquest");
  assert.ok(action.troops >= 1 && action.troops <= 6);
});

test("conquista mantém stack quando o novo território abre corredor até o objetivo", () => {
  const strategicState = state({
    objective: { type: "regions", params: { regions: ["sudeste"] }, targetPlayerId: null },
    territories: [
      { territoryId: 1, ownerPlayerId: "10", troops: 8, movedInTurn: 0 },
      { territoryId: 2, ownerPlayerId: "10", troops: 1, movedInTurn: 0 },
      { territoryId: 3, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
      { territoryId: 20, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
    ],
    topology: {
      connections: [connection(1, 2), connection(2, 3), connection(3, 20)],
      eventId: 0,
      resolvedEventEffects: [],
    },
  });
  const { plan, progress, values } = analysis(strategicState);
  assert.deepEqual(
    chooseConquestTransfer(strategicState, plan, progress, values, 1, 2),
    { type: "complete_conquest", troops: 4 },
  );
});

test("manobra move excedente para território com déficit e encerra após uma manobra", () => {
  const strategicState = state({
    room: { id: "1", phase: "maneuver", roundNumber: 1, reinforcementsRemaining: 0 },
    territories: [
      { territoryId: 1, ownerPlayerId: "10", troops: 8, movedInTurn: 0 },
      { territoryId: 2, ownerPlayerId: "10", troops: 1, movedInTurn: 0 },
      { territoryId: 3, ownerPlayerId: "20", troops: 8, movedInTurn: 0 },
    ],
    topology: {
      connections: [connection(1, 2), connection(2, 3)],
      eventId: 0,
      resolvedEventEffects: [],
    },
  });
  const { plan, progress, values } = analysis(strategicState);
  const first = chooseManeuver(strategicState, plan, progress, values);
  assert.equal(first.type, "maneuver");
  assert.equal(first.fromTerritoryId, 1);
  assert.equal(first.toTerritoryId, 2);

  const after = {
    ...strategicState,
    territories: strategicState.territories.map((territory) =>
      territory.territoryId === 2 ? { ...territory, movedInTurn: 2, troops: 3 } : territory,
    ),
  };
  assert.deepEqual(chooseManeuver(after, plan, progress, values), { type: "end_turn" });
});
