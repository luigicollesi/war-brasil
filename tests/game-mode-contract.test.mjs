import assert from "node:assert/strict";
import test from "node:test";
import {
  GAME_RULESETS,
  isGameRuleset,
  territoryControlProgress,
} from "../.test-build/game-mode.js";

test("game modes expõem somente objective e supremacy", () => {
  assert.deepEqual(GAME_RULESETS, ["objective", "supremacy"]);
  assert.equal(isGameRuleset("objective"), true);
  assert.equal(isGameRuleset("supremacy"), true);
  assert.equal(isGameRuleset("classic"), false);
});

test("progresso territorial usa o total real recebido", () => {
  const territories = [
    { ownerPlayerId: "10" },
    { ownerPlayerId: "10" },
    { ownerPlayerId: "20" },
  ];

  assert.deepEqual(territoryControlProgress(territories, "10"), {
    owned: 2,
    total: 3,
    ratio: 2 / 3,
  });
});

test("progresso territorial vazio nunca divide por zero", () => {
  assert.deepEqual(territoryControlProgress([], "10"), {
    owned: 0,
    total: 0,
    ratio: 0,
  });
});
