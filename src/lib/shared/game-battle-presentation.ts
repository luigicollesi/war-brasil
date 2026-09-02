import { attackerLossPerComparison, type AttackMode } from "./game-barrier-rules";
import type { GameBattle } from "./game-contract";

export type BattleComparisonRow = {
  attackerDie: number;
  defenderDie: number;
  loser: "attacker" | "defender";
  troopLoss: 1 | 3;
};

export function battleAttackMode(battle: GameBattle): AttackMode {
  return battle.attackMode ?? "normal";
}

export function battleComparisonRows(
  battle: Pick<GameBattle, "attacker" | "defender" | "attackMode">,
): BattleComparisonRow[] {
  const attackMode = battle.attackMode ?? "normal";
  const attackerLoss = attackerLossPerComparison(attackMode);
  const pairCount = Math.min(battle.attacker.length, battle.defender.length);

  return Array.from({ length: pairCount }, (_, index) => {
    const attackerDie = battle.attacker[index];
    const defenderDie = battle.defender[index];
    const attackerWins = attackerDie > defenderDie;

    return {
      attackerDie,
      defenderDie,
      loser: attackerWins ? "defender" : "attacker",
      troopLoss: attackerWins ? 1 : attackerLoss,
    };
  });
}

export function attackerComparisonLossCount(
  rows: readonly BattleComparisonRow[],
) {
  return rows.filter((row) => row.loser === "attacker").length;
}
