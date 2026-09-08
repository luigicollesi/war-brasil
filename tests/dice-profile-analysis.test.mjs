import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeDiceBalanceProfile,
  validateDiceBalanceProfileExact,
} from "../.test-build/shared/dice-profile-analysis.js";

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

test("análise exata encontra os limites do adaptive-halves-v1", () => {
  const analysis = analyzeDiceBalanceProfile(adaptiveProfile);
  const expected = [
    [0.109, 0.21233333333333332],
    [0.1, 0.2333333333333333],
    [0.091, 0.2543333333333333],
    [0.091, 0.2543333333333333],
    [0.1, 0.2333333333333333],
    [0.109, 0.21233333333333332],
  ];

  for (let index = 0; index < expected.length; index += 1) {
    approximately(analysis.faceRanges[index].minimum, expected[index][0]);
    approximately(analysis.faceRanges[index].maximum, expected[index][1]);
  }
  approximately(analysis.expectedValueRange.minimum, 2.96);
  approximately(analysis.expectedValueRange.maximum, 4.04);
});

test("validação exata rejeita faixa por face incompatível", () => {
  assert.throws(() =>
    validateDiceBalanceProfileExact({
      ...adaptiveProfile,
      maxFaceProbability: 0.25,
    }),
  );
});

test("validação exata rejeita pressureCap fora do domínio persistível", () => {
  assert.throws(
    () =>
      validateDiceBalanceProfileExact({
        ...adaptiveProfile,
        pressureCap: 1.2,
      }),
    /pressureCap precisa estar no intervalo/,
  );
});

test("perfil uniforme precisa ser canônico e sem estado adaptativo", () => {
  assert.throws(
    () =>
      validateDiceBalanceProfileExact({
        ...uniformProfile,
        alpha: 0.1,
      }),
    /parâmetros canônicos/,
  );
});

test("perfil uniforme tem faixa exata constante", () => {
  const analysis = analyzeDiceBalanceProfile(uniformProfile);

  for (const range of analysis.faceRanges) {
    approximately(range.minimum, 1 / 6);
    approximately(range.maximum, 1 / 6);
  }
  approximately(analysis.expectedValueRange.minimum, 3.5);
  approximately(analysis.expectedValueRange.maximum, 3.5);
});
