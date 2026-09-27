import "server-only";

export type BattlePassEventName =
  | "battle_pass_xp_granted"
  | "battle_pass_xp_duplicate_ignored"
  | "battle_pass_premium_unlocked"
  | "battle_pass_reward_claimed"
  | "battle_pass_claim_duplicate"
  | "battle_pass_claim_failed";

export type BattlePassEventFields = Readonly<{
  seasonId?: string | null;
  matchId?: string | null;
  userId?: string | null;
  xpEntryId?: string | null;
  rewardId?: string | null;
  purchaseId?: string | null;
  groupKey?: string | null;
  amount?: number | null;
  duplicate?: boolean | null;
  errorCode?: string | null;
}>;

export function logBattlePassEvent(
  event: BattlePassEventName,
  fields: BattlePassEventFields,
) {
  console.info(
    "[battle-pass]",
    JSON.stringify({
      event,
      ...fields,
    }),
  );
}
