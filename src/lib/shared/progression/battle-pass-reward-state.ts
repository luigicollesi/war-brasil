import type {
  BattlePassRewardState,
  BattlePassTrack,
} from "./battle-pass-contract";

export function deriveBattlePassRewardState(input: Readonly<{
  rewardLevel: number;
  levelReached: number;
  track: BattlePassTrack;
  premiumAccess: boolean;
  claimed: boolean;
}>): Exclude<BattlePassRewardState, "claiming"> {
  if (input.claimed) return "claimed";
  if (input.levelReached < input.rewardLevel) return "locked";
  if (input.track === "premium" && !input.premiumAccess) {
    return "premium_locked";
  }
  return "claimable";
}
