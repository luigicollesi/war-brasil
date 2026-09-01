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

type RecursiveForecast = {
  conquestProbability: number;
  expectedAttackerLosses: number;
  expectedDefenderLosses: number;
  conqueredRemainingWeighted: number;
};

const roundCache = new Map<string, RoundOutcome[]>();
const forecastCache = new Map<string, RecursiveForecast>();

function diceRolls(count: number) {
  const rolls: number[][] = [];
  const current: number[] = [];
  function visit(index: number) {
    if (index === count) {
      rolls.push([...current]);
      return;
    }
    for (let value = 1; value <= 6; value += 1) {
      current.push(value);
      visit(index + 1);
      current.pop();
    }
  }
  visit(0);
  return rolls;
}

export function battleRoundOutcomes(attackerDice: number, defenderDice: number) {
  const key = `${attackerDice}:${defenderDice}`;
  const cached = roundCache.get(key);
  if (cached) return cached;
  const attackerRolls = diceRolls(attackerDice);
  const defenderRolls = diceRolls(defenderDice);
  const counts = new Map<string, { count: number; attacker: number; defender: number }>();
  const total = attackerRolls.length * defenderRolls.length;
  for (const attacker of attackerRolls) {
    for (const defender of defenderRolls) {
      const result = resolveBattle(attacker, defender);
      const outcomeKey = `${result.attackerLosses}:${result.defenderLosses}`;
      const existing = counts.get(outcomeKey);
      if (existing) existing.count += 1;
      else counts.set(outcomeKey, { count: 1, attacker: result.attackerLosses, defender: result.defenderLosses });
    }
  }
  const outcomes = Array.from(counts.values()).map((entry) => ({
    probability: entry.count / total,
    attackerComparisonsLost: entry.attacker,
    defenderLosses: entry.defender,
  }));
  roundCache.set(key, outcomes);
  return outcomes;
}

function forecastRecursive(attackerTroops: number, defenderTroops: number, mode: AttackMode): RecursiveForecast {
  if (defenderTroops <= 0) {
    return { conquestProbability: 1, expectedAttackerLosses: 0, expectedDefenderLosses: 0, conqueredRemainingWeighted: attackerTroops };
  }
  const profile = attackProfile(attackerTroops, mode);
  if (profile.kind === "unavailable") {
    return { conquestProbability: 0, expectedAttackerLosses: 0, expectedDefenderLosses: 0, conqueredRemainingWeighted: 0 };
  }
  const key = `${mode}:${attackerTroops}:${defenderTroops}`;
  const cached = forecastCache.get(key);
  if (cached) return cached;
  const defenderDice = Math.min(3, defenderTroops);
  const outcomes = battleRoundOutcomes(profile.diceCount, defenderDice);
  let conquestProbability = 0;
  let expectedAttackerLosses = 0;
  let expectedDefenderLosses = 0;
  let conqueredRemainingWeighted = 0;
  for (const outcome of outcomes) {
    const attackerLosses = outcome.attackerComparisonsLost * profile.attackerLossPerComparison;
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
    conqueredRemainingWeighted += outcome.probability * child.conqueredRemainingWeighted;
  }
  const result = { conquestProbability, expectedAttackerLosses, expectedDefenderLosses, conqueredRemainingWeighted };
  forecastCache.set(key, result);
  return result;
}

export function forecastConquest(attackerTroops: number, defenderTroops: number, mode: AttackMode): CombatForecast {
  if (!Number.isInteger(attackerTroops) || !Number.isInteger(defenderTroops)) throw new RangeError("Quantidade de tropas precisa ser inteira.");
  if (attackerTroops < 1 || defenderTroops < 1) throw new RangeError("Quantidade de tropas precisa ser positiva.");
  const result = forecastRecursive(attackerTroops, defenderTroops, mode);
  return {
    conquestProbability: result.conquestProbability,
    expectedAttackerLosses: result.expectedAttackerLosses,
    expectedDefenderLosses: result.expectedDefenderLosses,
    expectedRemainingIfConquered: result.conquestProbability > 0 ? result.conqueredRemainingWeighted / result.conquestProbability : 0,
  };
}
