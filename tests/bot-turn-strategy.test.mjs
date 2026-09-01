import assert from "node:assert/strict";
import test from "node:test";
import { buildObjectivePlan, evaluateObjectiveProgress } from "../.test-build/bots/bot-objective-plan.js";
import { territoryStrategicValues } from "../.test-build/bots/bot-territory-value.js";
import { chooseCardTrade } from "../.test-build/bots/bot-cards.js";
import { chooseReinforcement } from "../.test-build/bots/bot-reinforcement.js";

function connection(territoryA, territoryB, passable = true) {
  return { territoryA, territoryB, exists: true, passable, barrierName: null, description: null };
}

function state(overrides = {}) {
  return {
    room: { id: "1", phase: "reinforcement", roundNumber: 1, reinforcementsRemaining: 3 },
    bot: { id: "10", cardTradeCount: 0 },
    objective: { type: "territories", params: { territories: 3 }, targetPlayerId: null },
    cards: [],
    players: [
      { id: "10", turnPosition: 1, isBot: true },
      { id: "20", turnPosition: 2, isBot: false },
    ],
    territories: [
      { territoryId: 1, ownerPlayerId: "10", troops: 3, movedInTurn: 0 },
      { territoryId: 2, ownerPlayerId: "10", troops: 1, movedInTurn: 0 },
      { territoryId: 3, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
    ],
    topology: { connections: [connection(1, 3), connection(2, 3)], eventId: 0, resolvedEventEffects: [] },
    ...overrides,
  };
}

function analysis(strategicState) {
  const plan = buildObjectivePlan(strategicState);
  const progress = evaluateObjectiveProgress(strategicState, plan);
  const values = territoryStrategicValues(strategicState, plan, progress);
  return { plan, progress, values };
}

test("cinco cartas sempre geram troca obrigatória quando existe combinação válida", () => {
  const strategicState = state({
    cards: [
      { id: "1", territoryId: 1, symbol: "leaf", isWild: false },
      { id: "2", territoryId: 2, symbol: "leaf", isWild: false },
      { id: "3", territoryId: 3, symbol: "leaf", isWild: false },
      { id: "4", territoryId: 4, symbol: "gold", isWild: false },
      { id: "5", territoryId: null, symbol: null, isWild: true },
    ],
  });
  const { plan, progress, values } = analysis(strategicState);
  assert.equal(chooseCardTrade(strategicState, plan, progress, values)?.type, "trade_cards");
});

test("troca preserva coringa quando combinação equivalente sem coringa existe", () => {
  const strategicState = state({
    cards: [
      { id: "1", territoryId: 1, symbol: "leaf", isWild: false },
      { id: "2", territoryId: 2, symbol: "leaf", isWild: false },
      { id: "3", territoryId: 3, symbol: "leaf", isWild: false },
      { id: "4", territoryId: null, symbol: null, isWild: true },
      { id: "5", territoryId: 4, symbol: "gold", isWild: false },
    ],
  });
  const { plan, progress, values } = analysis(strategicState);
  const action = chooseCardTrade(strategicState, plan, progress, values);
  assert.equal(action.type, "trade_cards");
  assert.ok(!action.cardIds.includes("4"));
});

test("fortification reforça primeiro o território mais barato para qualificar", () => {
  const strategicState = state({
    objective: { type: "fortification", params: { territories: 2, minTroops: 4 }, targetPlayerId: null },
    room: { id: "1", phase: "reinforcement", roundNumber: 1, reinforcementsRemaining: 3 },
    territories: [
      { territoryId: 1, ownerPlayerId: "10", troops: 4, movedInTurn: 0 },
      { territoryId: 2, ownerPlayerId: "10", troops: 3, movedInTurn: 0 },
      { territoryId: 3, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
    ],
  });
  const { plan, progress, values } = analysis(strategicState);
  assert.deepEqual(chooseReinforcement(strategicState, plan, progress, values), {
    type: "reinforce",
    territoryId: 2,
    troops: 1,
  });
});

test("expansão concentra reforço na origem da melhor rota ao objetivo", () => {
  const strategicState = state({
    territories: [
      { territoryId: 1, ownerPlayerId: "10", troops: 5, movedInTurn: 0 },
      { territoryId: 2, ownerPlayerId: "10", troops: 5, movedInTurn: 0 },
      { territoryId: 3, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
      { territoryId: 4, ownerPlayerId: "20", troops: 7, movedInTurn: 0 },
    ],
    topology: { connections: [connection(1, 3), connection(2, 4)], eventId: 0, resolvedEventEffects: [] },
  });
  const { plan, progress, values } = analysis(strategicState);
  assert.deepEqual(chooseReinforcement(strategicState, plan, progress, values), {
    type: "reinforce",
    territoryId: 1,
    troops: 3,
  });
});

test("reforço ofensivo ignora origem bloqueada por evento", () => {
  const strategicState = state({
    territories: [
      { territoryId: 1, ownerPlayerId: "10", troops: 5, movedInTurn: 0 },
      { territoryId: 2, ownerPlayerId: "10", troops: 5, movedInTurn: 0 },
      { territoryId: 3, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
      { territoryId: 4, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
    ],
    topology: {
      connections: [connection(1, 3), connection(2, 4)],
      eventId: 9,
      resolvedEventEffects: [{ type: "BLOCK_ATTACK", territories: [1] }],
    },
  });
  const { plan, progress, values } = analysis(strategicState);
  assert.deepEqual(chooseReinforcement(strategicState, plan, progress, values), {
    type: "reinforce",
    territoryId: 2,
    troops: 3,
  });
});
