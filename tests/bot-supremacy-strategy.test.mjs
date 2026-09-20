import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildObjectivePlan,
  evaluateObjectiveProgress,
} from "../.test-build/bots/bot-objective-plan.js";

function supremacyState() {
  return {
    room: {
      id: "1",
      ruleset: "supremacy",
      phase: "attack",
      roundNumber: 3,
      reinforcementsRemaining: 0,
      conqueredThisTurn: false,
    },
    bot: { id: "10", cardTradeCount: 0 },
    objective: null,
    cards: [],
    players: [
      { id: "10", turnPosition: 1, isBot: true },
      { id: "20", turnPosition: 2, isBot: false },
    ],
    territories: [
      { territoryId: 1, ownerPlayerId: "10", troops: 4, movedInTurn: 0 },
      { territoryId: 2, ownerPlayerId: "10", troops: 3, movedInTurn: 0 },
      { territoryId: 3, ownerPlayerId: "20", troops: 1, movedInTurn: 0 },
    ],
    topology: {
      connections: [
        {
          territoryA: 1,
          territoryB: 3,
          exists: true,
          passable: true,
          barrierName: null,
          description: null,
        },
      ],
      eventId: 0,
      resolvedEventEffects: [],
    },
  };
}

test("bot de supremacia planeja domínio total sem objetivo individual", () => {
  const state = supremacyState();
  const plan = buildObjectivePlan(state);
  const progress = evaluateObjectiveProgress(state, plan);

  assert.deepEqual(plan, { kind: "supremacy", territoryCount: 3 });
  assert.equal(progress.ratio, 2 / 3);
  assert.equal(progress.immediateWinPossible, true);
  assert.deepEqual(progress.primaryTargets, [3]);
  assert.equal(progress.missingTerritories, 1);
});

test("loader de bot aceita supremacia sem player_objective", () => {
  const service = readFileSync("src/lib/server/bots/bot-state-service.ts", "utf8");

  assert.match(service, /ruleset_snapshot/);
  assert.match(service, /room\.ruleset === "objective"/);
  assert.match(service, /objective:\s*objectiveSnapshot/);
  assert.doesNotMatch(service, /if \(!objective\) throw new Error\("Objetivo do bot não encontrado\."\);/);
});
