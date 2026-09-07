import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDiceDistribution,
  decayDicePressure,
  distributionToIntegerWeights,
  effectiveBatchAlpha,
  expectedDiceValue,
  faceForWeightedDraw,
  pressureCorrection,
  scoreDiceFace,
  UNIFORM_DICE_DISTRIBUTION,
  updateDicePressure,
} from "../.test-build/shared/dice-balance.js";

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

const uniformProfile = {
  algorithm: "uniform",
  alpha: 0,
  pressureCap: 0,
  deadZone: 0,
  retentionPerRound: 1,
  maxGroupShift: 0,
  innerTilt: 0,
  minFaceProbability: 1 / 6,
  maxFaceProbability: 1 / 6,
};

function approximately(actual, expected, epsilon = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `esperado ${expected}, recebido ${actual}`,
  );
}

function approximatelyArray(actual, expected, epsilon = 1e-12) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    approximately(actual[index], expected[index], epsilon);
  }
}

test("pontuação das faces é simétrica entre 1 e 6", () => {
  approximatelyArray(
    [1, 2, 3, 4, 5, 6].map(scoreDiceFace),
    [-1, -0.6, -0.2, 0.2, 0.6, 1],
  );
});

test("alpha efetivo incorpora o batch uma única vez", () => {
  approximately(effectiveBatchAlpha(0.12, 1), 0.12);
  approximately(effectiveBatchAlpha(0.12, 3), 1 - 0.88 ** 3);
});

test("dead zone mantém pressão pequena completamente neutra", () => {
  assert.equal(pressureCorrection(0, 0.6, 0.1), 0);
  assert.equal(pressureCorrection(0.1, 0.6, 0.1), 0);
  assert.equal(pressureCorrection(-0.1, 0.6, 0.1), 0);
  approximately(pressureCorrection(0.35, 0.6, 0.1), 0.5);
  approximately(pressureCorrection(-0.35, 0.6, 0.1), -0.5);
});

test("perfil uniforme ignora pressure e preserva 1/6 por face", () => {
  approximatelyArray(
    buildDiceDistribution(uniformProfile, 0.6),
    UNIFORM_DICE_DISTRIBUTION,
  );
  approximatelyArray(
    buildDiceDistribution(uniformProfile, -0.6),
    UNIFORM_DICE_DISTRIBUTION,
  );
});

test("estado neutro do perfil adaptativo preserva dado uniforme", () => {
  approximatelyArray(
    buildDiceDistribution(adaptiveProfile, 0),
    UNIFORM_DICE_DISTRIBUTION,
  );
  approximatelyArray(
    buildDiceDistribution(adaptiveProfile, 0.1),
    UNIFORM_DICE_DISTRIBUTION,
  );
});

test("pressão positiva máxima favorece 1-3 protegendo os extremos", () => {
  const distribution = buildDiceDistribution(adaptiveProfile, 0.6);
  approximatelyArray(distribution, [
    0.21233333333333332,
    0.2333333333333333,
    0.2543333333333333,
    0.091,
    0.1,
    0.109,
  ]);
  approximately(expectedDiceValue(distribution), 2.96);
});

test("pressão negativa máxima é o espelho exato da positiva", () => {
  const positive = buildDiceDistribution(adaptiveProfile, 0.6);
  const negative = buildDiceDistribution(adaptiveProfile, -0.6);
  approximatelyArray(negative, [...positive].reverse());
  approximately(expectedDiceValue(negative), 4.04);
});

test("pressão além do cap produz a mesma distribuição do cap", () => {
  approximatelyArray(
    buildDiceDistribution(adaptiveProfile, 4),
    buildDiceDistribution(adaptiveProfile, 0.6),
  );
  approximatelyArray(
    buildDiceDistribution(adaptiveProfile, -4),
    buildDiceDistribution(adaptiveProfile, -0.6),
  );
});

test("decay por rodada reduz pressão sem usar tempo de relógio", () => {
  approximately(
    decayDicePressure({
      pressure: 0.5,
      currentRound: 4,
      lastRollRound: 1,
      retentionPerRound: 0.8,
    }),
    0.256,
  );
  approximately(
    decayDicePressure({
      pressure: -0.5,
      currentRound: 4,
      lastRollRound: 1,
      retentionPerRound: 0.8,
    }),
    -0.256,
  );
});

test("batch de três extremos usa alpha efetivo uma única vez", () => {
  const expected = 1 - 0.88 ** 3;
  approximately(
    updateDicePressure({
      pressure: 0,
      dice: [6, 6, 6],
      alpha: 0.12,
      pressureCap: 0.6,
    }),
    expected,
  );
  approximately(
    updateDicePressure({
      pressure: 0,
      dice: [1, 1, 1],
      alpha: 0.12,
      pressureCap: 0.6,
    }),
    -expected,
  );
});

test("conversão para pesos inteiros conserva exatamente a massa total", () => {
  const distribution = buildDiceDistribution(adaptiveProfile, 0.6);
  const weights = distributionToIntegerWeights(distribution, 6_000_000);
  assert.equal(weights.reduce((sum, weight) => sum + weight, 0), 6_000_000);
  assert.equal(weights.every(Number.isInteger), true);
});

test("sampler ponderado respeita todas as fronteiras de intervalo", () => {
  const weights = [2, 3, 1, 4, 2, 1];
  const expectedByDraw = [1, 1, 2, 2, 2, 3, 4, 4, 4, 4, 5, 5, 6];
  assert.deepEqual(
    expectedByDraw.map((_, draw) => faceForWeightedDraw(weights, draw)),
    expectedByDraw,
  );
  assert.throws(() => faceForWeightedDraw(weights, -1), /fora do intervalo/);
  assert.throws(() => faceForWeightedDraw(weights, 13), /fora do intervalo/);
});
