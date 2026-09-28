export const BETA_TESTER_WELCOME_REWARD = {
  id: "beta-tester-welcome-v1",
  titleId: "title.beta-tester",
  titleDisplay: "BETA TESTER",
  credits: 3000,
  dice: [
    {
      id: "dice.attack.brazil",
      slot: "dice_attack",
      label: "Ataque",
      assetKey: "cosmetics/dice/brazil/attack.webp",
    },
    {
      id: "dice.defense.brazil",
      slot: "dice_defense",
      label: "Defesa",
      assetKey: "cosmetics/dice/brazil/defense.webp",
    },
    {
      id: "dice.neutral.brazil",
      slot: "dice_neutral",
      label: "Neutro",
      assetKey: "cosmetics/dice/brazil/neutral.webp",
    },
  ],
} as const;

export type BetaTesterWelcomeRewardState = Readonly<{
  eligible: boolean;
  claimed: boolean;
  pending: boolean;
}>;

export type BetaTesterWelcomeRewardClaimResult = Readonly<{
  ok: true;
  alreadyClaimed: boolean;
  creditsGranted: number;
  walletBalance: number;
  grantedCosmeticIds: readonly string[];
}>;
