import { REGION_REINFORCEMENT_BONUSES, TERRITORY_METADATA, type CardSymbol } from "./game-config";

export function reinforcementBase(territoryCount: number) {
  return Math.max(3, Math.floor(territoryCount / 2));
}

function regionBonus(territoryIds: number[]) {
  const controlled = new Set(territoryIds);
  return Object.entries(REGION_REINFORCEMENT_BONUSES).reduce((total, [region, bonus]) => {
    const regionTerritories = Object.entries(TERRITORY_METADATA)
      .filter(([, territory]) => territory.region === region)
      .map(([id]) => Number(id));
    return regionTerritories.every((id) => controlled.has(id)) ? total + bonus : total;
  }, 0);
}

export function reinforcementFor(territoryIds: number[]) {
  return reinforcementBase(territoryIds.length) + regionBonus(territoryIds);
}

export function resolveBattle(attacker: number[], defender: number[]) {
  const sortedAttacker = [...attacker].sort((a, b) => b - a);
  const sortedDefender = [...defender].sort((a, b) => b - a);
  let attackerLosses = 0;
  let defenderLosses = 0;
  for (let index = 0; index < Math.min(sortedAttacker.length, sortedDefender.length); index += 1) {
    if (sortedAttacker[index] > sortedDefender[index]) defenderLosses += 1;
    else attackerLosses += 1;
  }
  return { attacker: sortedAttacker, defender: sortedDefender, attackerLosses, defenderLosses };
}

export function tradeValue(tradeCountBefore: number) {
  const values = [4, 6, 8, 10, 12, 15];
  return values[tradeCountBefore] ?? 20 + (tradeCountBefore - 6) * 5;
}

export function isValidTrade(symbols: Array<CardSymbol | "wild">) {
  if (symbols.length !== 3) return false;
  const wildcards = symbols.filter((symbol) => symbol === "wild").length;
  const regular = symbols.filter((symbol): symbol is CardSymbol => symbol !== "wild");
  if (wildcards === 3) return true;
  const unique = new Set(regular);
  return unique.size === 1 || unique.size + wildcards === 3;
}
