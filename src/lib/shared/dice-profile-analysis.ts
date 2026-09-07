import {
  buildDiceDistribution,
  DiceBalanceConfigurationError,
  type DiceBalanceProfile,
} from "./dice-balance";

type Range = {
  minimum: number;
  maximum: number;
};

type Quadratic = {
  a: number;
  b: number;
  c: number;
};

export type DiceBalanceProfileAnalysis = {
  faceRanges: readonly [Range, Range, Range, Range, Range, Range];
  expectedValueRange: Range;
};

const EPSILON = 1e-12;
const ONE_SIXTH = 1 / 6;

function evaluate(polynomial: Quadratic, q: number) {
  return polynomial.a * q * q + polynomial.b * q + polynomial.c;
}

function exactRange(polynomial: Quadratic): Range {
  const candidates = [-1, 1];
  if (Math.abs(polynomial.a) > EPSILON) {
    const vertex = -polynomial.b / (2 * polynomial.a);
    if (vertex > -1 && vertex < 1) candidates.push(vertex);
  }

  const values = candidates.map((q) => evaluate(polynomial, q));
  return {
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
}

function facePolynomial(
  profile: DiceBalanceProfile,
  face: 1 | 2 | 3 | 4 | 5 | 6,
): Quadratic {
  const isLow = face <= 3;
  const center = isLow ? 2 : 5;
  const direction = face - center;
  const groupSign = isLow ? 1 : -1;

  return {
    a: groupSign * profile.maxGroupShift * profile.innerTilt * direction,
    b:
      groupSign * (profile.maxGroupShift / 3) +
      0.5 * profile.innerTilt * direction,
    c: ONE_SIXTH,
  };
}

function expectedValuePolynomial(polynomials: readonly Quadratic[]): Quadratic {
  return polynomials.reduce<Quadratic>(
    (result, polynomial, index) => {
      const face = index + 1;
      return {
        a: result.a + face * polynomial.a,
        b: result.b + face * polynomial.b,
        c: result.c + face * polynomial.c,
      };
    },
    { a: 0, b: 0, c: 0 },
  );
}

function assertRangeWithinProfile(range: Range, profile: DiceBalanceProfile) {
  if (
    !Number.isFinite(range.minimum) ||
    !Number.isFinite(range.maximum) ||
    range.minimum < profile.minFaceProbability - EPSILON ||
    range.maximum > profile.maxFaceProbability + EPSILON
  ) {
    throw new DiceBalanceConfigurationError(
      "Perfil de balanceamento produz probabilidade fora dos limites configurados.",
    );
  }
}

export function analyzeDiceBalanceProfile(
  profile: DiceBalanceProfile,
): DiceBalanceProfileAnalysis {
  buildDiceDistribution(profile, 0);

  if (String(profile.algorithm) === "uniform") {
    const range = { minimum: ONE_SIXTH, maximum: ONE_SIXTH };
    return {
      faceRanges: [range, range, range, range, range, range],
      expectedValueRange: { minimum: 3.5, maximum: 3.5 },
    };
  }

  if (String(profile.algorithm) !== "adaptive_halves") {
    throw new DiceBalanceConfigurationError(
      `Algoritmo de balanceamento desconhecido: ${String(profile.algorithm)}.`,
    );
  }

  const polynomials = ([1, 2, 3, 4, 5, 6] as const).map((face) =>
    facePolynomial(profile, face),
  );
  const faceRanges = polynomials.map(exactRange) as unknown as DiceBalanceProfileAnalysis["faceRanges"];

  for (const range of faceRanges) assertRangeWithinProfile(range, profile);

  return {
    faceRanges,
    expectedValueRange: exactRange(expectedValuePolynomial(polynomials)),
  };
}

export function validateDiceBalanceProfileExact(profile: DiceBalanceProfile) {
  analyzeDiceBalanceProfile(profile);
  return profile;
}
