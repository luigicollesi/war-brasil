import {
  buildDiceDistribution,
  decayDicePressure,
  distributionToIntegerWeights,
  faceForWeightedDraw,
  pressureCorrection,
  updateDicePressure,
  type DiceBalanceProfile,
  type DiceFace,
  type DiceWeightDistribution,
} from "./dice-balance";

export type CombatDiceState = {
  pressure: number;
  batchCount: number;
  lastRollRound: number | null;
};

export type RandomIntSource = (minimum: number, maximum: number) => number;

export type CombatDiceBatchResult = {
  dice: DiceFace[];
  nextState: CombatDiceState | null;
  recoveredState: boolean;
};

function assertDiceInput(roundNumber: number, diceCount: number) {
  if (!Number.isInteger(roundNumber) || roundNumber < 1) {
    throw new RangeError("roundNumber precisa ser um inteiro positivo.");
  }
  if (!Number.isInteger(diceCount) || diceCount < 1 || diceCount > 3) {
    throw new RangeError("diceCount de combate precisa estar entre 1 e 3.");
  }
}

function assertState(state: CombatDiceState) {
  if (!Number.isFinite(state.pressure) || Math.abs(state.pressure) > 1) {
    throw new RangeError("pressure do estado precisa estar no intervalo [-1, 1].");
  }
  if (!Number.isInteger(state.batchCount) || state.batchCount < 0) {
    throw new RangeError("batchCount precisa ser um inteiro não negativo.");
  }
  if (
    state.lastRollRound !== null &&
    (!Number.isInteger(state.lastRollRound) || state.lastRollRound < 1)
  ) {
    throw new RangeError("lastRollRound precisa ser nulo ou um inteiro positivo.");
  }
  if (
    (state.batchCount === 0 && state.lastRollRound !== null) ||
    (state.batchCount > 0 && state.lastRollRound === null)
  ) {
    throw new RangeError("Histórico do estado de dados está inconsistente.");
  }
}

function uniformFace(randomIntSource: RandomIntSource): DiceFace {
  const face = randomIntSource(1, 7);
  if (!Number.isInteger(face) || face < 1 || face > 6) {
    throw new RangeError("Fonte aleatória retornou face uniforme inválida.");
  }
  return face as DiceFace;
}

function normalizedAdaptiveState(
  state: CombatDiceState,
  roundNumber: number,
): { state: CombatDiceState; recovered: boolean } {
  assertState(state);
  if (state.lastRollRound === null || state.lastRollRound <= roundNumber) {
    return { state, recovered: false };
  }

  return {
    state: {
      pressure: 0,
      batchCount: 0,
      lastRollRound: null,
    },
    recovered: true,
  };
}

function symmetricWeights(
  profile: DiceBalanceProfile,
  pressure: number,
  weightTotal: number,
): DiceWeightDistribution {
  const canonicalDistribution = buildDiceDistribution(profile, Math.abs(pressure));
  const canonicalWeights = distributionToIntegerWeights(
    canonicalDistribution,
    weightTotal,
  );
  if (pressure >= 0) return canonicalWeights;
  return [...canonicalWeights].reverse() as unknown as DiceWeightDistribution;
}

export function rollCombatDiceBatch(input: {
  profile: DiceBalanceProfile;
  state: CombatDiceState | null;
  roundNumber: number;
  diceCount: number;
  randomIntSource: RandomIntSource;
  weightTotal: number;
}): CombatDiceBatchResult {
  const {
    profile,
    state,
    roundNumber,
    diceCount,
    randomIntSource,
    weightTotal,
  } = input;

  assertDiceInput(roundNumber, diceCount);

  if (profile.algorithm === "uniform") {
    return {
      dice: Array.from({ length: diceCount }, () => uniformFace(randomIntSource)),
      nextState: null,
      recoveredState: false,
    };
  }

  if (!state) {
    throw new RangeError("Perfil adaptativo exige estado de dados do jogador.");
  }

  const normalized = normalizedAdaptiveState(state, roundNumber);
  const decayedPressure = decayDicePressure({
    pressure: normalized.state.pressure,
    currentRound: roundNumber,
    lastRollRound: normalized.state.lastRollRound,
    retentionPerRound: profile.retentionPerRound,
  });
  const correction = pressureCorrection(
    decayedPressure,
    profile.pressureCap,
    profile.deadZone,
  );

  // Inside the dead zone the contract is exact fairness, not an integer-weight
  // approximation of 1/6. This also avoids introducing a deterministic rounding
  // preference between faces while pressure is neutral.
  const dice =
    correction === 0
      ? Array.from({ length: diceCount }, () => uniformFace(randomIntSource))
      : (() => {
          const weights = symmetricWeights(profile, decayedPressure, weightTotal);
          return Array.from({ length: diceCount }, () =>
            faceForWeightedDraw(weights, randomIntSource(0, weightTotal)),
          );
        })();

  const nextPressure = updateDicePressure({
    pressure: decayedPressure,
    dice,
    alpha: profile.alpha,
    pressureCap: profile.pressureCap,
  });

  return {
    dice,
    nextState: {
      pressure: nextPressure,
      batchCount: normalized.state.batchCount + 1,
      lastRollRound: roundNumber,
    },
    recoveredState: normalized.recovered,
  };
}
