import type {
  BattlePassRewardKind,
  BattlePassTrack,
} from "./battle-pass-contract";

export type BattlePassResolvedRewardState =
  | "locked"
  | "premium_locked"
  | "claimable"
  | "claimed";

export type BattlePassRewardPresentation = Readonly<{
  id: string;
  level: number;
  track: BattlePassTrack;
  position: number;
  kind: BattlePassRewardKind;
  state: BattlePassResolvedRewardState;
  creditAmount: number | null;
  itemId: string | null;
  name: string;
  description: string | null;
  rarity: string | null;
  slot: string | null;
  previewRef: string | null;
  title:
    | Readonly<{
        displayText: string;
        rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
        fontKey: string;
        styleKey: string;
        textureRef: string | null;
      }>
    | null;
}>;

export type BattlePassLevelPresentation = Readonly<{
  level: number;
  requiredTotalXp: number;
  freeRewards: ReadonlyArray<BattlePassRewardPresentation>;
  premiumRewards: ReadonlyArray<BattlePassRewardPresentation>;
}>;

export type BattlePassSnapshot = Readonly<{
  season: Readonly<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    status: "active" | "ended";
    startsAt: string;
    endsAt: string;
    claimEndsAt: string;
    heroAssetRef: string | null;
    logoAssetRef: string | null;
  }>;
  progress: Readonly<{
    xpTotal: number;
    levelReached: number;
    currentLevelXp: number;
    nextLevelXp: number | null;
    xpToNextLevel: number;
  }>;
  premium: Readonly<{
    access: boolean;
    price: 3000;
    offerId: string | null;
    retroactiveClaimableCount: number;
  }>;
  walletBalance: number;
  claimableCount: number;
  levels: ReadonlyArray<BattlePassLevelPresentation>;
}>;

export type BattlePassHomeSummary =
  | Readonly<{
      active: false;
    }>
  | Readonly<{
      active: true;
      seasonName: string;
      levelReached: number;
      xpTotal: number;
      currentLevelXp: number;
      nextLevelXp: number | null;
      claimableCount: number;
    }>;


export type BattlePassMatchResult = Readonly<{
  seasonId: string;
  seasonName: string;
  matchId: string;
  xpGranted: number;
  totalXpAfter: number;
  levelBefore: number;
  levelAfter: number;
  levelsGained: number;
  isWinner: boolean;
  breakdown: Readonly<{
    completionXp: number;
    victoryBonusXp: number;
    multiplierBps: number;
    humanParticipantCount: number;
  }>;
}>;
