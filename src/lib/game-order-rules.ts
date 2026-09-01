export type OrderPlayer = {
  id: string;
};

export type OrderRoll = {
  player_id: string;
  roll_round: number;
  value: number;
};

export function orderRollHistories(
  players: OrderPlayer[],
  rolls: OrderRoll[],
) {
  const values = new Map(players.map((player) => [player.id, [] as number[]]));
  for (const roll of rolls) values.get(roll.player_id)?.push(roll.value);
  return values;
}

export function unresolvedOrderPlayerIds(values: Map<string, number[]>) {
  const groups = new Map<string, string[]>();

  for (const [id, history] of values) {
    const key = history.join(",");
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .flat();
}

export function eligibleOrderPlayerIds(
  players: OrderPlayer[],
  rolls: OrderRoll[],
  round: number,
) {
  return unresolvedOrderPlayerIds(
    orderRollHistories(
      players,
      rolls.filter((roll) => roll.roll_round < round),
    ),
  );
}

export function nextOrderRollPlayerId(
  players: OrderPlayer[],
  rolls: OrderRoll[],
  round: number,
) {
  const eligible = eligibleOrderPlayerIds(players, rolls, round);
  return (
    eligible.find(
      (playerId) =>
        !rolls.some(
          (roll) => roll.player_id === playerId && roll.roll_round === round,
        ),
    ) ?? null
  );
}

export function compareOrderRollHistories(a: number[], b: number[]) {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (b[index] ?? -1) - (a[index] ?? -1);
    if (difference) return difference;
  }
  return 0;
}
