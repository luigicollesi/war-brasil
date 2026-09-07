import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSymmetricDiceWeights,
  rollCombatDiceBatch,
} from "../.test-build/shared/combat-dice-engine.js";

const adaptiveProfile = {
  algorithm: "adaptive_halves",
  alpha: 0.12,
  pressureCap: 0.60,
  deadZone: 0.10,
  retentionPerRound: 0.80,
  maxGroupShift: 0.20,
  innerTilt: 0.03,
  minFaceProbability: 0.09,
  maxFaceProbability: 0.27,
};

function sequenceRandom(values) {
  let index = 0;
  const calls = [];
  const source = (minimum, maximum) => {
    calls.push([minimum, maximum]);
    if (index >= values.length) throw new Error("sequência aleatória esgotada");
    return values[index++];
  };
  source.calls = calls;
  return source;
}

test("dead zone adaptativa usa dado uniforme exato", () => {
  const random = sequenceRandom([6, 1, 4]);
  const result = rollCombatDiceBatch({
    profile: adaptiveProfile,
    state: { pressure: 0.05, batchCount: 1, lastRollRound: 1 },
    roundNumber: 1,
    diceCount: 3,
    randomIntSource: random,
    weightTotal: 6_000_000,
  });

  assert.deepEqual(result.dice, [6, 1, 4]);
  assert.deepEqual(random.calls, [[1, 7], [1, 7], [1, 7]]);
  assert.equal(result.nextState.batchCount, 2);
});

test("pesos negativos são o espelho exato dos positivos", () => {
  for (const pressure of [0.11, 0.20, 0.35, 0.60]) {
    const positive = buildSymmetricDiceWeights(
      adaptiveProfile,
      pressure,
      6_000_000,
    );
    const negative = buildSymmetricDiceWeights(
      adaptiveProfile,
      -pressure,
      6_000_000,
    );

    assert.deepEqual(negative, [...positive].reverse());
    assert.equal(positive.reduce((sum, weight) => sum + weight, 0), 6_000_000);
    assert.equal(negative.reduce((sum, weight) => sum + weight, 0), 6_000_000);
  }
});

test("batch_count incrementa uma vez por batch", () => {
  const result = rollCombatDiceBatch({
    profile: adaptiveProfile,
    state: { pressure: 0.4, batchCount: 7, lastRollRound: 2 },
    roundNumber: 2,
    diceCount: 3,
    randomIntSource: sequenceRandom([0, 0, 0]),
    weightTotal: 6_000_000,
  });

  assert.equal(result.nextState.batchCount, 8);
  assert.equal(result.nextState.lastRollRound, 2);
});
