import assert from "node:assert/strict";
import test from "node:test";
import {
  attackProfile,
  maneuverTraversalProfile,
} from "../.test-build/game-barrier-rules.js";

test("ataque normal preserva a progressão clássica de dados", () => {
  assert.deepEqual(attackProfile(1, "normal"), {
    kind: "unavailable",
    mode: "normal",
    minimumTroops: 2,
  });
  assert.equal(attackProfile(2, "normal").diceCount, 1);
  assert.equal(attackProfile(3, "normal").diceCount, 2);
  assert.equal(attackProfile(4, "normal").diceCount, 3);
  assert.equal(attackProfile(20, "normal").diceCount, 3);
});

test("ataque por barreira usa limiares 4, 7 e 10", () => {
  assert.deepEqual(attackProfile(3, "barrier"), {
    kind: "unavailable",
    mode: "barrier",
    minimumTroops: 4,
  });

  for (const troops of [4, 5, 6]) {
    assert.equal(attackProfile(troops, "barrier").diceCount, 1);
  }
  for (const troops of [7, 8, 9]) {
    assert.equal(attackProfile(troops, "barrier").diceCount, 2);
  }
  for (const troops of [10, 11, 100]) {
    assert.equal(attackProfile(troops, "barrier").diceCount, 3);
  }
});

test("cada derrota do atacante custa uma tropa normal ou três na barreira", () => {
  assert.equal(attackProfile(4, "normal").attackerLossPerComparison, 1);
  assert.equal(attackProfile(4, "barrier").attackerLossPerComparison, 3);
});

test("limiares da barreira nunca esvaziam a origem no pior caso", () => {
  for (const troops of [4, 7, 10]) {
    const profile = attackProfile(troops, "barrier");
    assert.equal(profile.kind, "available");
    const worstLoss = profile.diceCount * profile.attackerLossPerComparison;
    assert.ok(troops - worstLoss >= 1);
  }
});

test("perfil de manobra classifica zero, uma e múltiplas barreiras", () => {
  assert.deepEqual(maneuverTraversalProfile(0), {
    kind: "normal",
    barrierCount: 0,
    troopLoss: 0,
    minimumTroops: 1,
  });
  assert.deepEqual(maneuverTraversalProfile(1), {
    kind: "barrier",
    barrierCount: 1,
    troopLoss: 1,
    minimumTroops: 2,
  });
  assert.deepEqual(maneuverTraversalProfile(2), {
    kind: "blocked",
    barrierCount: 2,
    minimumBarrierCount: 2,
  });
});

test("barrierCount inválido é tratado como violação de contrato interno", () => {
  assert.throws(() => maneuverTraversalProfile(-1), RangeError);
  assert.throws(() => maneuverTraversalProfile(1.5), RangeError);
});
