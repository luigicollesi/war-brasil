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

type ClaimOutcome = Readonly<{
  rewardId: string;
  seasonId: string;
  amount: number | null;
  alreadyClaimed: boolean;
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

export function logBattlePassClaimOutcomes(
  userId: string,
  claims: ReadonlyArray<ClaimOutcome>,
  groupKey: string | null = null,
) {
  for (const claim of claims) {
    logBattlePassEvent(
      claim.alreadyClaimed
        ? "battle_pass_claim_duplicate"
        : "battle_pass_reward_claimed",
      {
        seasonId: claim.seasonId,
        userId,
        rewardId: claim.rewardId,
        groupKey,
        amount: claim.amount,
        duplicate: claim.alreadyClaimed,
      },
    );
  }
}

export function battlePassErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return "BATTLE_PASS_UNEXPECTED_ERROR";
}
