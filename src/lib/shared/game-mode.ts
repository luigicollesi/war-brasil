export const GAME_RULESETS = ["objective", "supremacy"] as const;

export type GameRuleset = (typeof GAME_RULESETS)[number];

export function isGameRuleset(value: unknown): value is GameRuleset {
  return GAME_RULESETS.some((ruleset) => ruleset === value);
}

export function territoryControlProgress(
  territories: readonly { ownerPlayerId: string }[],
  playerId: string,
) {
  const total = territories.length;
  const owned = territories.filter(
    (territory) => territory.ownerPlayerId === playerId,
  ).length;

  return {
    owned,
    total,
    ratio: total > 0 ? owned / total : 0,
  };
}
