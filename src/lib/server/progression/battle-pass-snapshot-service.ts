import "server-only";

import { BATTLE_PASS_PREMIUM_PRICE } from "@/src/lib/shared/progression/battle-pass-contract";
import { deriveBattlePassRewardState } from "@/src/lib/shared/progression/battle-pass-reward-state";
import type {
  BattlePassHomeSummary,
  BattlePassLevelPresentation,
  BattlePassRewardPresentation,
  BattlePassSnapshot,
} from "@/src/lib/shared/progression/battle-pass-presentation";
import {
  diceAssetDeliveryPath,
  territorySkinAssetDeliveryPath,
} from "@/src/lib/server/assets/asset-storage-service";
import { findCampaignCreditWallet } from "@/src/lib/server/economy/economy-repository";
import { profileAppearanceAssetDeliveryPath } from "@/src/lib/server/profile/profile-appearance-asset-storage";
import { pool } from "@/src/lib/server/db/pool";

type SeasonRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "active" | "ended";
  starts_at: Date;
  ends_at: Date;
  claim_ends_at: Date;
  hero_asset_ref: string | null;
  logo_asset_ref: string | null;
};

type LevelRow = {
  level: number;
  required_total_xp: string;
};

type RewardRow = {
  id: string;
  level: number;
  track: "free" | "premium";
  position: number;
  reward_kind:
    | "campaign_credit"
    | "game_cosmetic"
    | "commander_title"
    | "profile_background";
  credit_amount: string | null;
  cosmetic_id: string | null;
  title_id: string | null;
  background_id: string | null;
  cosmetic_name: string | null;
  cosmetic_description: string | null;
  cosmetic_rarity: string | null;
  cosmetic_slot: string | null;
  cosmetic_asset_ref: string | null;
  cosmetic_preview_ref: string | null;
  title_name: string | null;
  title_description: string | null;
  title_display_text: string | null;
  title_rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | null;
  title_font_key: string | null;
  title_style_key: string | null;
  title_texture_ref: string | null;
  background_name: string | null;
  background_description: string | null;
  background_rarity: string | null;
  background_asset_ref: string | null;
  background_preview_ref: string | null;
  claimed: boolean;
};

function safeInteger(value: string | number, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function clientAssetRef(value: string | null) {
  if (!value) return null;
  return value.startsWith("/") || /^https?:\/\//i.test(value) ? value : null;
}

function cosmeticAssetRef(row: RewardRow) {
  const raw = row.cosmetic_preview_ref ?? row.cosmetic_asset_ref;
  if (!raw) return null;
  const direct = clientAssetRef(raw);
  if (direct) return direct;
  try {
    if (row.cosmetic_slot === "territory_skin") {
      return territorySkinAssetDeliveryPath(raw);
    }
    if (
      row.cosmetic_slot === "dice_attack" ||
      row.cosmetic_slot === "dice_defense" ||
      row.cosmetic_slot === "dice_neutral"
    ) {
      return diceAssetDeliveryPath(raw);
    }
  } catch {
    return null;
  }
  return null;
}

function appearanceAssetRef(value: string | null) {
  if (!value) return null;
  const direct = clientAssetRef(value);
  if (direct) return direct;
  try {
    return profileAppearanceAssetDeliveryPath(value);
  } catch {
    return null;
  }
}

async function loadVisibleSeason() {
  const result = await pool.query<SeasonRow>(
    `SELECT id,slug,name,description,status,starts_at,ends_at,claim_ends_at,
            hero_asset_ref,logo_asset_ref
       FROM catalog.battle_pass_seasons
      WHERE status IN ('active','ended')
        AND starts_at <= NOW()
        AND claim_ends_at >= NOW()
      ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END,
               starts_at DESC,
               id
      LIMIT 1`,
  );
  return result.rows[0] ?? null;
}

async function loadProgress(userId: string, seasonId: string) {
  const result = await pool.query<{
    xp_total: string;
    level_reached: number;
  }>(
    `SELECT xp_total::text,level_reached
       FROM progression.battle_pass_progress
      WHERE season_id=$1 AND user_id=$2::uuid`,
    [seasonId, userId],
  );
  return {
    xpTotal: safeInteger(result.rows[0]?.xp_total ?? 0),
    levelReached: safeInteger(result.rows[0]?.level_reached ?? 1, 1),
  };
}

async function loadPremiumAccess(userId: string, seasonId: string) {
  const result = await pool.query<{ access: boolean }>(
    `SELECT EXISTS(
       SELECT 1
         FROM progression.battle_pass_access
        WHERE season_id=$1 AND user_id=$2::uuid
     ) AS access`,
    [seasonId, userId],
  );
  return result.rows[0]?.access === true;
}

async function loadLevels(seasonId: string) {
  const result = await pool.query<LevelRow>(
    `SELECT level,required_total_xp::text
       FROM catalog.battle_pass_levels
      WHERE season_id=$1
      ORDER BY level`,
    [seasonId],
  );
  return result.rows;
}

async function loadRewards(userId: string, seasonId: string) {
  const result = await pool.query<RewardRow>(
    `SELECT
       reward.id,reward.level,reward.track,reward.position,reward.reward_kind,
       reward.credit_amount::text,reward.cosmetic_id,reward.title_id,reward.background_id,
       cosmetic.name AS cosmetic_name,
       cosmetic.description AS cosmetic_description,
       cosmetic.rarity AS cosmetic_rarity,
       cosmetic.slot AS cosmetic_slot,
       cosmetic.asset_ref AS cosmetic_asset_ref,
       cosmetic.preview_ref AS cosmetic_preview_ref,
       title.name AS title_name,
       title.description AS title_description,
       title.display_text AS title_display_text,
       title.rarity AS title_rarity,
       title.font_key AS title_font_key,
       title.style_key AS title_style_key,
       title.texture_ref AS title_texture_ref,
       background.name AS background_name,
       background.description AS background_description,
       background.rarity AS background_rarity,
       background.asset_ref AS background_asset_ref,
       background.preview_ref AS background_preview_ref,
       (claimed.reward_id IS NOT NULL) AS claimed
     FROM catalog.battle_pass_rewards reward
     LEFT JOIN catalog.cosmetics cosmetic ON cosmetic.id=reward.cosmetic_id
     LEFT JOIN catalog.commander_titles title ON title.id=reward.title_id
     LEFT JOIN catalog.profile_backgrounds background
       ON background.id=reward.background_id
     LEFT JOIN progression.battle_pass_reward_claims claimed
       ON claimed.user_id=$2::uuid
      AND claimed.reward_id=reward.id
     WHERE reward.season_id=$1
     ORDER BY reward.level,reward.track,reward.position,reward.id`,
    [seasonId, userId],
  );
  return result.rows;
}

function rewardName(row: RewardRow) {
  if (row.reward_kind === "campaign_credit") {
    return `${safeInteger(row.credit_amount ?? 0)} Créditos de Campanha`;
  }
  return (
    row.cosmetic_name ??
    row.title_name ??
    row.background_name ??
    "Recompensa de Campanha"
  );
}

function rewardDescription(row: RewardRow) {
  return (
    row.cosmetic_description ??
    row.title_description ??
    row.background_description ??
    null
  );
}

function rewardPresentation(
  row: RewardRow,
  levelReached: number,
  premiumAccess: boolean,
): BattlePassRewardPresentation {
  const state = deriveBattlePassRewardState({
    rewardLevel: row.level,
    levelReached,
    track: row.track,
    premiumAccess,
    claimed: row.claimed,
  });
  const itemId = row.cosmetic_id ?? row.title_id ?? row.background_id ?? null;
  const title =
    row.reward_kind === "commander_title" &&
    row.title_display_text &&
    row.title_rarity &&
    row.title_font_key &&
    row.title_style_key
      ? {
          displayText: row.title_display_text,
          rarity: row.title_rarity,
          fontKey: row.title_font_key,
          styleKey: row.title_style_key,
          textureRef: appearanceAssetRef(row.title_texture_ref),
        }
      : null;

  return {
    id: row.id,
    level: row.level,
    track: row.track,
    position: row.position,
    kind: row.reward_kind,
    state,
    creditAmount:
      row.reward_kind === "campaign_credit"
        ? safeInteger(row.credit_amount ?? 0)
        : null,
    itemId,
    name: rewardName(row),
    description: rewardDescription(row),
    rarity:
      row.cosmetic_rarity ?? row.title_rarity ?? row.background_rarity ?? null,
    slot: row.cosmetic_slot,
    previewRef:
      row.reward_kind === "game_cosmetic"
        ? cosmeticAssetRef(row)
        : row.reward_kind === "profile_background"
          ? appearanceAssetRef(
              row.background_preview_ref ?? row.background_asset_ref,
            )
          : title?.textureRef ?? null,
    title,
  };
}

function progressWindow(
  levels: ReadonlyArray<LevelRow>,
  levelReached: number,
  xpTotal: number,
) {
  const current =
    levels.find((row) => Number(row.level) === levelReached) ?? levels[0];
  const next = levels.find((row) => Number(row.level) === levelReached + 1);
  const currentLevelXp = safeInteger(current?.required_total_xp ?? 0);
  const nextLevelXp = next ? safeInteger(next.required_total_xp) : null;
  return {
    currentLevelXp,
    nextLevelXp,
    xpToNextLevel:
      nextLevelXp === null ? 0 : Math.max(0, nextLevelXp - xpTotal),
  };
}

export async function getBattlePassSnapshot(
  userId: string,
): Promise<BattlePassSnapshot | null> {
  const season = await loadVisibleSeason();
  if (!season) return null;

  const [progress, premiumAccess, levelRows, rewardRows, wallet] =
    await Promise.all([
      loadProgress(userId, season.id),
      loadPremiumAccess(userId, season.id),
      loadLevels(season.id),
      loadRewards(userId, season.id),
      findCampaignCreditWallet(userId),
    ]);

  const rewards = rewardRows.map((row) =>
    rewardPresentation(row, progress.levelReached, premiumAccess),
  );
  const rewardsByLevel = new Map<number, BattlePassRewardPresentation[]>();
  for (const reward of rewards) {
    const current = rewardsByLevel.get(reward.level) ?? [];
    current.push(reward);
    rewardsByLevel.set(reward.level, current);
  }

  const levels: BattlePassLevelPresentation[] = levelRows.map((row) => {
    const levelRewards = rewardsByLevel.get(Number(row.level)) ?? [];
    return {
      level: Number(row.level),
      requiredTotalXp: safeInteger(row.required_total_xp),
      freeRewards: levelRewards.filter((reward) => reward.track === "free"),
      premiumRewards: levelRewards.filter(
        (reward) => reward.track === "premium",
      ),
    };
  });

  const window = progressWindow(
    levelRows,
    progress.levelReached,
    progress.xpTotal,
  );

  return {
    season: {
      id: season.id,
      slug: season.slug,
      name: season.name,
      description: season.description,
      status: season.status,
      startsAt: season.starts_at.toISOString(),
      endsAt: season.ends_at.toISOString(),
      claimEndsAt: season.claim_ends_at.toISOString(),
      heroAssetRef: clientAssetRef(season.hero_asset_ref),
      logoAssetRef: clientAssetRef(season.logo_asset_ref),
    },
    progress: {
      xpTotal: progress.xpTotal,
      levelReached: progress.levelReached,
      ...window,
    },
    premium: {
      access: premiumAccess,
      price: BATTLE_PASS_PREMIUM_PRICE,
    },
    walletBalance: safeInteger(wallet?.balance ?? 0),
    claimableCount: rewards.filter((reward) => reward.state === "claimable")
      .length,
    levels,
  };
}

export async function getBattlePassHomeSummary(
  userId: string,
): Promise<BattlePassHomeSummary> {
  const season = await loadVisibleSeason();
  if (!season) return { active: false };

  const [progress, premiumAccess, levels] = await Promise.all([
    loadProgress(userId, season.id),
    loadPremiumAccess(userId, season.id),
    loadLevels(season.id),
  ]);
  const claimable = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
       FROM catalog.battle_pass_rewards reward
       LEFT JOIN progression.battle_pass_reward_claims claimed
         ON claimed.user_id=$2::uuid
        AND claimed.reward_id=reward.id
      WHERE reward.season_id=$1
        AND reward.level <= $3
        AND claimed.reward_id IS NULL
        AND (reward.track='free' OR $4::boolean)`,
    [season.id, userId, progress.levelReached, premiumAccess],
  );
  const window = progressWindow(
    levels,
    progress.levelReached,
    progress.xpTotal,
  );

  return {
    active: true,
    seasonName: season.name,
    levelReached: progress.levelReached,
    xpTotal: progress.xpTotal,
    currentLevelXp: window.currentLevelXp,
    nextLevelXp: window.nextLevelXp,
    claimableCount: safeInteger(claimable.rows[0]?.count ?? 0),
  };
}
