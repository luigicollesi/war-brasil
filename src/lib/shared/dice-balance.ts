export type DiceFace = 1 | 2 | 3 | 4 | 5 | 6;

export type DiceDistribution = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];

export type DiceWeightDistribution = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];

export type DiceBalanceAlgorithm = "uniform" | "adaptive_halves";

export type DiceBalanceProfile = {
  algorithm: DiceBalanceAlgorithm;
  alpha: number;
  pressureCap: number;
  deadZone: number;
  retentionPerRound: number;
  maxGroupShift: number;
  innerTilt: number;
  minFaceProbability: number;
  maxFaceProbability: number;
};

export class DiceBalanceConfigurationError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "DiceBalanceConfigurationError";
  }
}

const FACE_COUNT = 6;
const HALF_FACE_COUNT = 3;
const UNIFORM_FACE_PROBABILITY = 1 / FACE_COUNT;
const HALF_PROBABILITY = 0.5;
const CONDITIONAL_HALF_PROBABILITY = 1 / HALF_FACE_COUNT;
const EPSILON = 1e-12;

export const UNIFORM_DICE_DISTRIBUTION: DiceDistribution = [
  UNIFORM_FACE_PROBABILITY,
  UNIFORM_FACE_PROBABILITY,
  UNIFORM_FACE_PROBABILITY,
  UNIFORM_FACE_PROBABILITY,
  UNIFORM_FACE_PROBABILITY,
  UNIFORM_FACE_PROBABILITY,
];

function assertFinite(value: number, name: string) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} precisa ser finito.`);
  }
}

function assertConfigFinite(value: number, name: string) {
  if (!Number.isFinite(value)) {
    throw new DiceBalanceConfigurationError(`${name} precisa ser finito.`);
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function assertProbabilityBounds(profile: DiceBalanceProfile) {
  assertConfigFinite(profile.minFaceProbability, "minFaceProbability");
  assertConfigFinite(profile.maxFaceProbability, "maxFaceProbability");
  if (
    profile.minFaceProbability <= 0 ||
    profile.maxFaceProbability >= 1 ||
    profile.minFaceProbability > profile.maxFaceProbability
  ) {
    throw new DiceBalanceConfigurationError(
      "Limites de probabilidade por face inválidos.",
    );
  }
}

function assertAdaptiveProfile(profile: DiceBalanceProfile) {
  assertConfigFinite(profile.alpha, "alpha");
  assertConfigFinite(profile.pressureCap, "pressureCap");
  assertConfigFinite(profile.deadZone, "deadZone");
  assertConfigFinite(profile.retentionPerRound, "retentionPerRound");
  assertConfigFinite(profile.maxGroupShift, "maxGroupShift");
  assertConfigFinite(profile.innerTilt, "innerTilt");
  assertProbabilityBounds(profile);

  if (profile.alpha <= 0 || profile.alpha > 1) {
    throw new DiceBalanceConfigurationError(
      "alpha precisa estar no intervalo (0, 1].",
    );
  }
  if (profile.pressureCap <= 0 || profile.pressureCap > 1) {
    throw new DiceBalanceConfigurationError(
      "pressureCap precisa estar no intervalo (0, 1].",
    );
  }
  if (profile.deadZone < 0 || profile.deadZone >= profile.pressureCap) {
    throw new DiceBalanceConfigurationError(
      "deadZone precisa estar entre zero e pressureCap.",
    );
  }
  if (profile.retentionPerRound <= 0 || profile.retentionPerRound > 1) {
    throw new DiceBalanceConfigurationError(
      "retentionPerRound precisa estar no intervalo (0, 1].",
    );
  }
  if (profile.maxGroupShift <= 0 || profile.maxGroupShift >= HALF_PROBABILITY) {
    throw new DiceBalanceConfigurationError(
      "maxGroupShift precisa estar no intervalo (0, 0.5).",
    );
  }
  if (profile.innerTilt < 0 || profile.innerTilt >= CONDITIONAL_HALF_PROBABILITY) {
    throw new DiceBalanceConfigurationError(
      "innerTilt precisa estar no intervalo [0, 1/3).",
    );
  }
}

function assertDistributionWithinProfile(
  distribution: DiceDistribution,
  profile: DiceBalanceProfile,
) {
  const total = distribution.reduce((sum, probability) => sum + probability, 0);
  if (Math.abs(total - 1) > EPSILON) {
    throw new DiceBalanceConfigurationError("Distribuição de dados não soma 1.");
  }

  for (const probability of distribution) {
    if (!Number.isFinite(probability)) {
      throw new DiceBalanceConfigurationError(
        "Perfil de balanceamento produz probabilidade não finita.",
      );
    }
    if (
      probability < profile.minFaceProbability - EPSILON ||
      probability > profile.maxFaceProbability + EPSILON
    ) {
      throw new DiceBalanceConfigurationError(
        "Perfil de balanceamento produz probabilidade fora dos limites configurados.",
      );
    }
  }
}

export function scoreDiceFace(face: number) {
  if (!Number.isInteger(face) || face < 1 || face > 6) {
    throw new RangeError("Face do dado precisa ser um inteiro entre 1 e 6.");
  }
  return (face - 3.5) / 2.5;
}

export function effectiveBatchAlpha(alpha: number, diceCount: number) {
  assertFinite(alpha, "alpha");
  if (alpha < 0 || alpha > 1) {
    throw new RangeError("alpha precisa estar no intervalo [0, 1].");
  }
  if (!Number.isInteger(diceCount) || diceCount < 1) {
    throw new RangeError("diceCount precisa ser um inteiro positivo.");
  }
  return 1 - (1 - alpha) ** diceCount;
}

export function decayDicePressure(input: {
  pressure: number;
  currentRound: number;
  lastRollRound: number | null;
  retentionPerRound: number;
}) {
  const { pressure, currentRound, lastRollRound, retentionPerRound } = input;
  assertFinite(pressure, "pressure");
  assertFinite(retentionPerRound, "retentionPerRound");

  if (!Number.isInteger(currentRound) || currentRound < 1) {
    throw new RangeError("currentRound precisa ser um inteiro positivo.");
  }
  if (retentionPerRound <= 0 || retentionPerRound > 1) {
    throw new RangeError("retentionPerRound precisa estar no intervalo (0, 1].");
  }
  if (lastRollRound === null) return pressure;
  if (!Number.isInteger(lastRollRound) || lastRollRound < 1) {
    throw new RangeError("lastRollRound precisa ser nulo ou um inteiro positivo.");
  }
  if (currentRound < lastRollRound) {
    throw new RangeError("currentRound não pode ser anterior a lastRollRound.");
  }

  return pressure * retentionPerRound ** (currentRound - lastRollRound);
}

export function pressureCorrection(
  pressure: number,
  pressureCap: number,
  deadZone: number,
) {
  assertFinite(pressure, "pressure");
  assertFinite(pressureCap, "pressureCap");
  assertFinite(deadZone, "deadZone");
  if (pressureCap <= 0 || deadZone < 0 || deadZone >= pressureCap) {
    throw new RangeError("Configuração de pressão inválida.");
  }

  const magnitude = Math.min(Math.abs(pressure), pressureCap);
  if (magnitude <= deadZone) return 0;

  const normalized = (magnitude - deadZone) / (pressureCap - deadZone);
  const smoothstep = normalized * normalized * (3 - 2 * normalized);
  return Math.sign(pressure) * smoothstep;
}

export function buildDiceDistribution(
  profile: DiceBalanceProfile,
  pressure: number,
): DiceDistribution {
  const algorithm = String(profile.algorithm);
  if (algorithm === "uniform") {
    assertProbabilityBounds(profile);
    if (
      profile.alpha !== 0 ||
      profile.pressureCap !== 0 ||
      profile.deadZone !== 0 ||
      profile.retentionPerRound !== 1 ||
      profile.maxGroupShift !== 0 ||
      profile.innerTilt !== 0
    ) {
      throw new DiceBalanceConfigurationError(
        "Perfil uniforme precisa usar parâmetros canônicos sem estado adaptativo.",
      );
    }
    assertDistributionWithinProfile(UNIFORM_DICE_DISTRIBUTION, profile);
    return UNIFORM_DICE_DISTRIBUTION;
  }
  if (algorithm !== "adaptive_halves") {
    throw new DiceBalanceConfigurationError(
      `Algoritmo de balanceamento desconhecido: ${algorithm}.`,
    );
  }

  assertAdaptiveProfile(profile);
  const correction = pressureCorrection(
    pressure,
    profile.pressureCap,
    profile.deadZone,
  );
  const lowMass = HALF_PROBABILITY + profile.maxGroupShift * correction;
  const highMass = HALF_PROBABILITY - profile.maxGroupShift * correction;

  const lowConditional = [1, 2, 3].map(
    (face) =>
      CONDITIONAL_HALF_PROBABILITY +
      profile.innerTilt * correction * (face - 2),
  );
  const highConditional = [4, 5, 6].map(
    (face) =>
      CONDITIONAL_HALF_PROBABILITY +
      profile.innerTilt * correction * (face - 5),
  );

  const distribution = [
    lowMass * lowConditional[0],
    lowMass * lowConditional[1],
    lowMass * lowConditional[2],
    highMass * highConditional[0],
    highMass * highConditional[1],
    highMass * highConditional[2],
  ] as const;

  assertDistributionWithinProfile(distribution, profile);
  return distribution;
}

export function updateDicePressure(input: {
  pressure: number;
  dice: readonly number[];
  alpha: number;
  pressureCap: number;
}) {
  const { pressure, dice, alpha, pressureCap } = input;
  assertFinite(pressure, "pressure");
  assertFinite(pressureCap, "pressureCap");
  if (pressureCap <= 0 || pressureCap > 1) {
    throw new RangeError("pressureCap precisa estar no intervalo (0, 1].");
  }
  if (dice.length < 1) {
    throw new RangeError("A rolagem precisa conter ao menos um dado.");
  }

  const batchMean =
    dice.reduce((sum, face) => sum + scoreDiceFace(face), 0) / dice.length;
  const batchAlpha = effectiveBatchAlpha(alpha, dice.length);
  return clamp(
    (1 - batchAlpha) * pressure + batchAlpha * batchMean,
    -pressureCap,
    pressureCap,
  );
}

export function expectedDiceValue(distribution: DiceDistribution) {
  return distribution.reduce(
    (expected, probability, index) => expected + probability * (index + 1),
    0,
  );
}

export function distributionToIntegerWeights(
  distribution: DiceDistribution,
  totalWeight: number,
): DiceWeightDistribution {
  if (!Number.isInteger(totalWeight) || totalWeight < FACE_COUNT) {
    throw new RangeError("totalWeight precisa ser um inteiro de pelo menos 6.");
  }

  const totalProbability = distribution.reduce(
    (sum, probability) => sum + probability,
    0,
  );
  if (Math.abs(totalProbability - 1) > EPSILON) {
    throw new RangeError("Distribuição de dados não soma 1.");
  }
  if (distribution.some((probability) => probability < 0 || probability > 1)) {
    throw new RangeError("Distribuição contém probabilidade inválida.");
  }

  const exactWeights = distribution.map((probability) => probability * totalWeight);
  const weights = exactWeights.map(Math.floor);
  let remaining = totalWeight - weights.reduce((sum, weight) => sum + weight, 0);

  const remainderOrder = exactWeights
    .map((exact, index) => ({ index, remainder: exact - Math.floor(exact) }))
    .sort((left, right) =>
      right.remainder === left.remainder
        ? left.index - right.index
        : right.remainder - left.remainder,
    );

  for (let index = 0; index < remainderOrder.length && remaining > 0; index += 1) {
    weights[remainderOrder[index].index] += 1;
    remaining -= 1;
  }

  if (remaining !== 0) {
    throw new RangeError("Não foi possível normalizar os pesos da distribuição.");
  }

  return weights as unknown as DiceWeightDistribution;
}

export function faceForWeightedDraw(
  weights: readonly number[],
  draw: number,
): DiceFace {
  if (weights.length !== FACE_COUNT) {
    throw new RangeError("Distribuição ponderada precisa conter seis faces.");
  }
  if (weights.some((weight) => !Number.isInteger(weight) || weight < 0)) {
    throw new RangeError("Pesos das faces precisam ser inteiros não negativos.");
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight < 1) {
    throw new RangeError("Distribuição ponderada precisa ter peso total positivo.");
  }
  if (!Number.isInteger(draw) || draw < 0 || draw >= totalWeight) {
    throw new RangeError("Sorteio ponderado fora do intervalo da distribuição.");
  }

  let cumulative = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cumulative += weights[index];
    if (draw < cumulative) return (index + 1) as DiceFace;
  }

  throw new RangeError("Distribuição ponderada não cobriu o sorteio informado.");
}
