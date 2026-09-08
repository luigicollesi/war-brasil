import {
  UNIFORM_DICE_DISTRIBUTION,
  type DiceDistribution,
} from "../dice-balance";
import { attackProfile, type AttackMode } from "../game-barrier-rules";
import { resolveBattle } from "../game-rules";

export type CombatForecast = {
  conquestProbability: number;
  expectedAttackerLosses: number;
  expectedDefenderLosses: number;
  expectedRemainingIfConquered: number;
};

type RoundOutcome = {
  probability: number;
  attackerComparisonsLost: number;
  defenderLosses: number;
};

type WeightedRoll = {
  values: number[];
  probability: number;
};

type RecursiveForecast = {
  conquestProbability: number;
  expectedAttackerLosses: number;
  expectedDefenderLosses: number;
  conqueredRemainingWeighted: number;
};

const roundCache = new Map<string, RoundOutcome[]>();
const forecastCache = new Map<string, RecursiveForecast>();

function assertDistribution(distribution: DiceDistribution) {
  const total = distribution.reduce((sum, probability) => sum + probability, 0);
  if (
    distribution.some(
      (probability) => !Number.isFinite(probability) || probability < 0,
    ) ||
    Math.abs(total - 1) > 1e-12
  ) {
    throw new RangeError("Distribuição de combate inválida.");
  }
}

function distributionKey(distribution: DiceDistribution) {
  return distribution.map((probability) => probability.toPrecision(17)).join(",");
}

function diceRolls(count: number, distribution: DiceDistribution) {
  assertDistribution(distribution);
  const rolls: WeightedRoll[] = [];
  const current: number[] = [];

  function visit(index: number, probability: number) {
    if (index === count) {
      rolls.push({ values: [...current], probability });
      return;
    }

    for (let value = 1; value <= 6; value += 1) {
      const faceProbability = distribution[value - 1];
      if (faceProbability === 0) continue;
      current.push(value);
      visit(index + 1, probability * faceProbability);
      current.pop();
    }
  }

  visit(0, 1);
  return rolls;
}

export function battleRoundOutcomes(
  attackerDice: number,
  defenderDice: number,
  attackerDistribution: DiceDistribution = UNIFORM_DICE_DISTRIBUTION,
  defenderDistribution: DiceDistribution = UNIFORM_DICE_DISTRIBUTION,
) {
  const key = [
    attackerDice,
    defenderDice,
    distributionKey(attackerDistribution),
    distributionKey(defenderDistribution),
  ].join(":");
  const cached = roundCache.get(key);
  if (cached) return cached;

  const attackerRolls = diceRolls(attackerDice, attackerDistribution);
  const defenderRolls = diceRolls(defenderDice, defenderDistribution);
  const outcomes = new Map<
    string,
    { probability: number; attacker: number; defender: number }
  >();

  for (const attacker of attackerRolls) {
    for (const defender of defenderRolls) {
      const result = resolveBattle(attacker.values, defender.values);
      const outcomeKey = `${result.attackerLosses}:${result.defenderLosses}`;
      const probability = attacker.probability * defender.probability;
      const existing = outcomes.get(outcomeKey);
      if (existing) existing.probability += probability;
      else {
        outcomes.set(outcomeKey, {
          probability,
          attacker: result.attackerLosses,
          defender: result.defenderLosses,
        });
      }
    }
  }

  const result = Array.from(outcomes.values()).map((entry) => ({
    probability: entry.probability,
    attackerComparisonsLost: entry.attacker,
    defenderLosses: entry.defender,
  }));
  roundCache.set(key, result);
  return result;
}

function forecastRecursive(
  attackerTroops: number,
  defenderTroops: number,
  mode: AttackMode,
): RecursiveForecast {
  if (defenderTroops <= 0) {
    return {
      conquestProbability: 1,
      expectedAttackerLosses: 0,
      expectedDefenderLosses: 0,
      conqueredRemainingWeighted: attackerTroops,
    };
  }
  const profile = attackProfile(attackerTroops, mode);
  if (profile.kind === "unavailable") {
    return {
      conquestProbability: 0,
      expectedAttackerLosses: 0,
      expectedDefenderLosses: 0,
      conqueredRemainingWeighted: 0,
    };
  }
  const key = `${mode}:${attackerTroops}:${defenderTroops}`;
  const cached = forecastCache.get(key);
  if (cached) return cached;
  const defenderDice = Math.min(3, defenderTroops);

  // Strategic forecasts intentionally remain neutral. The probability engine can
  // model arbitrary distributions, but bots do not receive hidden pressure that
  // a human player cannot observe.
  const outcomes = battleRoundOutcomes(profile.diceCount, defenderDice);
  let conquestProbability = 0;
  let expectedAttackerLosses = 0;
  let expectedDefenderLosses = 0;
  let conqueredRemainingWeighted = 0;
  for (const outcome of outcomes) {
    const attackerLosses =
      outcome.attackerComparisonsLost * profile.attackerLossPerComparison;
    const nextAttacker = attackerTroops - attackerLosses;
    const nextDefender = defenderTroops - outcome.defenderLosses;
    expectedAttackerLosses += outcome.probability * attackerLosses;
    expectedDefenderLosses += outcome.probability * outcome.defenderLosses;
    if (nextDefender <= 0) {
      conquestProbability += outcome.probability;
      conqueredRemainingWeighted += outcome.probability * nextAttacker;
      continue;
    }
    const child = forecastRecursive(nextAttacker, nextDefender, mode);
    conquestProbability += outcome.probability * child.conquestProbability;
    expectedAttackerLosses += outcome.probability * child.expectedAttackerLosses;
    expectedDefenderLosses += outcome.probability * child.expectedDefenderLosses;
    conqueredRemainingWeighted +=
      outcome.probability * child.conqueredRemainingWeighted;
  }
  const result = {
    conquestProbability,
    expectedAttackerLosses,
    expectedDefenderLosses,
    conqueredRemainingWeighted,
  };
  forecastCache.set(key, result);
  return result;
}

export function forecastConquest(
  attackerTroops: number,
  defenderTroops: number,
  mode: AttackMode,
): CombatForecast {
  if (!Number.isInteger(attackerTroops) || !Number.isInteger(defenderTroops)) {
    throw new RangeError("Quantidade de tropas precisa ser inteira.");
  }
  if (attackerTroops < 1 || defenderTroops < 1) {
    throw new RangeError("Quantidade de tropas precisa ser positiva.");
  }
  const result = forecastRecursive(attackerTroops, defenderTroops, mode);
  return {
    conquestProbability: result.conquestProbability,
    expectedAttackerLosses: result.expectedAttackerLosses,
    expectedDefenderLosses: result.expectedDefenderLosses,
    expectedRemainingIfConquered:
      result.conquestProbability > 0
        ? result.conqueredRemainingWeighted / result.conquestProbability
        : 0,
  };
}
