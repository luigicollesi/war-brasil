import "server-only";

import { pool } from "@/src/lib/server/db/pool";
import { ensureEconomyState } from "@/src/lib/server/economy/economy-service";
import type { PoolClient } from "pg";

const REWARD_ID_MAX_LENGTH = 160;
const SEASON_ID_MAX_LENGTH = 160;

type RewardRow = {
  id: string;
  season_id: string;
  level: number;
  track: "free" | "premium";
  reward_kind:
    | "campaign_credit"
    | "game_cosmetic"
    | "commander_title"
    | "profile_background";
  credit_amount: string | null;
  cosmetic_id: string | null;
  title_id: string | null;
  background_id: string | null;
  starts_at: Date;
  claim_ends_at: Date;
};

type ClaimContext = {
  reward: RewardRow;
  levelReached: number;
  premiumAccess: boolean;
};

export type BattlePassClaimResult = Readonly<{
  rewardId: string;
  seasonId: string;
  kind: RewardRow["reward_kind"];
  amount: number | null;
  entitlementId: string | null;
  alreadyClaimed: boolean;
}>;

export type BattlePassClaimAllResult = Readonly<{
  seasonId: string;
  rewards: ReadonlyArray<BattlePassClaimResult>;
  claimedCount: number;
  creditAmount: number;
}>;

export class BattlePassServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BattlePassServiceError";
  }
}

function requiredIdentifier(
  payload: unknown,
  key: "rewardId" | "seasonId",
  maxLength: number,
) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BattlePassServiceError(
      "BATTLE_PASS_INVALID_REQUEST",
      "Solicitação de Campanha inválida.",
      400,
    );
  }
  const input = payload as Record<string, unknown>;
  if (Object.keys(input).length !== 1 || typeof input[key] !== "string") {
    throw new BattlePassServiceError(
      "BATTLE_PASS_INVALID_REQUEST",
      "Solicitação de Campanha inválida.",
      400,
    );
  }
  const value = input[key].trim();
  if (!value || value.length > maxLength) {
    throw new BattlePassServiceError(
      "BATTLE_PASS_INVALID_REQUEST",
      "Solicitação de Campanha inválida.",
      400,
    );
  }
  return value;
}

export function parseBattlePassClaimInput(payload: unknown) {
  return {
    rewardId: requiredIdentifier(payload, "rewardId", REWARD_ID_MAX_LENGTH),
  };
}

export function parseBattlePassClaimAllInput(payload: unknown) {
  return {
    seasonId: requiredIdentifier(payload, "seasonId", SEASON_ID_MAX_LENGTH),
  };
}

async function loadReward(
  client: PoolClient,
  rewardId: string,
): Promise<RewardRow | null> {
  const result = await client.query<RewardRow>(
    `SELECT reward.id,reward.season_id,reward.level,reward.track,reward.reward_kind,
            reward.credit_amount::text,reward.cosmetic_id,reward.title_id,reward.background_id,
            season.starts_at,season.claim_ends_at
       FROM catalog.battle_pass_rewards reward
       JOIN catalog.battle_pass_seasons season ON season.id=reward.season_id
      WHERE reward.id=$1`,
    [rewardId],
  );
  return result.rows[0] ?? null;
}

async function ensureAndLockProgress(
  client: PoolClient,
  userId: string,
  seasonId: string,
) {
  await client.query(
    `INSERT INTO progression.battle_pass_progress(
       season_id,user_id,xp_total,level_reached
     )
     VALUES($1,$2::uuid,0,1)
     ON CONFLICT (season_id,user_id) DO NOTHING`,
    [seasonId, userId],
  );

  const result = await client.query<{ level_reached: number }>(
    `SELECT level_reached
       FROM progression.battle_pass_progress
      WHERE season_id=$1 AND user_id=$2::uuid
      FOR UPDATE`,
    [seasonId, userId],
  );
  return Number(result.rows[0]?.level_reached ?? 1);
}

async function hasPremiumAccess(
  client: PoolClient,
  userId: string,
  seasonId: string,
) {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1
         FROM progression.battle_pass_access
        WHERE season_id=$1 AND user_id=$2::uuid
     ) AS exists`,
    [seasonId, userId],
  );
  return result.rows[0]?.exists === true;
}

async function loadClaimContext(
  client: PoolClient,
  userId: string,
  rewardId: string,
): Promise<ClaimContext> {
  const reward = await loadReward(client, rewardId);
  if (!reward) {
    throw new BattlePassServiceError(
      "BATTLE_PASS_REWARD_NOT_FOUND",
      "A recompensa informada não existe.",
      404,
    );
  }

  const now = Date.now();
  if (
    reward.starts_at.getTime() > now ||
    reward.claim_ends_at.getTime() < now
  ) {
    throw new BattlePassServiceError(
      "BATTLE_PASS_CLAIM_WINDOW_CLOSED",
      "Esta recompensa não pode ser coletada neste momento.",
      409,
    );
  }

  const levelReached = await ensureAndLockProgress(
    client,
    userId,
    reward.season_id,
  );
  if (levelReached < Number(reward.level)) {
    throw new BattlePassServiceError(
      "BATTLE_PASS_LEVEL_REQUIRED",
      "O nível necessário para esta recompensa ainda não foi alcançado.",
      409,
    );
  }

  const premiumAccess =
    reward.track === "premium"
      ? await hasPremiumAccess(client, userId, reward.season_id)
      : false;

  if (reward.track === "premium" && !premiumAccess) {
    throw new BattlePassServiceError(
      "BATTLE_PASS_PREMIUM_REQUIRED",
      "A Trilha de Elite precisa estar ativa para coletar esta recompensa.",
      409,
    );
  }

  return { reward, levelReached, premiumAccess };
}

async function insertClaim(
  client: PoolClient,
  userId: string,
  reward: RewardRow,
) {
  const result = await client.query(
    `INSERT INTO progression.battle_pass_reward_claims(
       user_id,reward_id,season_id
     )
     VALUES($1::uuid,$2,$3)
     ON CONFLICT (user_id,reward_id) DO NOTHING
     RETURNING reward_id`,
    [userId, reward.id, reward.season_id],
  );
  return (result.rowCount ?? 0) === 1;
}

async function grantCreditReward(
  client: PoolClient,
  userId: string,
  reward: RewardRow,
) {
  const amount = Number(reward.credit_amount);
  if (!Number.isSafeInteger(amount) || amount < 5) {
    throw new BattlePassServiceError(
      "BATTLE_PASS_CATALOG_INVALID",
      "A configuração da recompensa está inválida.",
      503,
    );
  }

  await ensureEconomyState(userId, client);
  const wallet = await client.query(
    `UPDATE economy.wallets
        SET balance=balance+$2::bigint,
            updated_at=NOW()
      WHERE user_id=$1::uuid
        AND currency_code='campaign-credit'
      RETURNING balance`,
    [userId, amount],
  );
  if ((wallet.rowCount ?? 0) !== 1) {
    throw new BattlePassServiceError(
      "BATTLE_PASS_WALLET_UNAVAILABLE",
      "A carteira de Créditos de Campanha está indisponível.",
      503,
    );
  }

  await client.query(
    `INSERT INTO economy.ledger_entries(
       user_id,currency_code,delta,reason,domain_reference,idempotency_key
     )
     VALUES(
       $1::uuid,'campaign-credit',$2::bigint,'battle_pass_reward',$3,$4
     )
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      userId,
      amount,
      reward.id,
      `battle-pass:${reward.season_id}:${userId}:${reward.id}`,
    ],
  );

  return amount;
}

async function incrementRewardAcquisitionCount(
  client: PoolClient,
  reward: RewardRow,
) {
  if (reward.reward_kind === "game_cosmetic" && reward.cosmetic_id) {
    await client.query(
      `UPDATE catalog.cosmetic_stats
          SET acquisition_count=acquisition_count+1,updated_at=NOW()
        WHERE cosmetic_id=$1`,
      [reward.cosmetic_id],
    );
    return;
  }
  if (reward.reward_kind === "commander_title" && reward.title_id) {
    await client.query(
      `UPDATE catalog.commander_title_stats
          SET acquisition_count=acquisition_count+1,updated_at=NOW()
        WHERE title_id=$1`,
      [reward.title_id],
    );
    return;
  }
  if (reward.reward_kind === "profile_background" && reward.background_id) {
    await client.query(
      `UPDATE catalog.profile_background_stats
          SET acquisition_count=acquisition_count+1,updated_at=NOW()
        WHERE background_id=$1`,
      [reward.background_id],
    );
  }
}

async function grantEntitlementReward(
  client: PoolClient,
  userId: string,
  reward: RewardRow,
) {
  let entitlementId: string | null = null;
  let inserted = false;

  if (reward.reward_kind === "game_cosmetic") {
    if (!reward.cosmetic_id) {
      throw new BattlePassServiceError(
        "BATTLE_PASS_CATALOG_INVALID",
        "A configuração da recompensa está inválida.",
        503,
      );
    }
    const result = await client.query(
      `INSERT INTO inventory.cosmetics(
         user_id,cosmetic_id,slot,acquisition_source
       )
       SELECT $1::uuid,item.id,item.slot,'reward'
         FROM catalog.cosmetics item
        WHERE item.id=$2
       ON CONFLICT (user_id,cosmetic_id) DO NOTHING`,
      [userId, reward.cosmetic_id],
    );
    if ((result.rowCount ?? 0) === 0) {
      const known = await client.query(
        "SELECT 1 FROM catalog.cosmetics WHERE id=$1",
        [reward.cosmetic_id],
      );
      if ((known.rowCount ?? 0) !== 1) {
        throw new BattlePassServiceError(
          "BATTLE_PASS_CATALOG_INVALID",
          "A configuração da recompensa está inválida.",
          503,
        );
      }
    }
    inserted = (result.rowCount ?? 0) === 1;
    entitlementId = reward.cosmetic_id;
  } else if (reward.reward_kind === "commander_title") {
    if (!reward.title_id) {
      throw new BattlePassServiceError(
        "BATTLE_PASS_CATALOG_INVALID",
        "A configuração da recompensa está inválida.",
        503,
      );
    }
    const result = await client.query(
      `INSERT INTO profile.commander_titles(
         user_id,title_id,acquisition_source
       )
       VALUES($1::uuid,$2,'reward')
       ON CONFLICT (user_id,title_id) DO NOTHING`,
      [userId, reward.title_id],
    );
    inserted = (result.rowCount ?? 0) === 1;
    entitlementId = reward.title_id;
  } else if (reward.reward_kind === "profile_background") {
    if (!reward.background_id) {
      throw new BattlePassServiceError(
        "BATTLE_PASS_CATALOG_INVALID",
        "A configuração da recompensa está inválida.",
        503,
      );
    }
    const result = await client.query(
      `INSERT INTO profile.commander_backgrounds(
         user_id,background_id,acquisition_source
       )
       VALUES($1::uuid,$2,'reward')
       ON CONFLICT (user_id,background_id) DO NOTHING`,
      [userId, reward.background_id],
    );
    inserted = (result.rowCount ?? 0) === 1;
    entitlementId = reward.background_id;
  }

  if (inserted) await incrementRewardAcquisitionCount(client, reward);
  return entitlementId;
}

async function claimRewardInTransaction(
  client: PoolClient,
  userId: string,
  rewardId: string,
): Promise<BattlePassClaimResult> {
  const { reward } = await loadClaimContext(client, userId, rewardId);
  const created = await insertClaim(client, userId, reward);

  if (!created) {
    return {
      rewardId: reward.id,
      seasonId: reward.season_id,
      kind: reward.reward_kind,
      amount: null,
      entitlementId:
        reward.cosmetic_id ?? reward.title_id ?? reward.background_id ?? null,
      alreadyClaimed: true,
    };
  }

  let amount: number | null = null;
  let entitlementId: string | null = null;

  if (reward.reward_kind === "campaign_credit") {
    amount = await grantCreditReward(client, userId, reward);
  } else {
    entitlementId = await grantEntitlementReward(client, userId, reward);
  }

  return {
    rewardId: reward.id,
    seasonId: reward.season_id,
    kind: reward.reward_kind,
    amount,
    entitlementId,
    alreadyClaimed: false,
  };
}

export async function claimBattlePassReward(
  userId: string,
  rewardId: string,
): Promise<BattlePassClaimResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await claimRewardInTransaction(client, userId, rewardId);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function claimAllBattlePassRewards(
  userId: string,
  seasonId: string,
): Promise<BattlePassClaimAllResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const season = await client.query<{
      starts_at: Date;
      claim_ends_at: Date;
    }>(
      `SELECT starts_at,claim_ends_at
         FROM catalog.battle_pass_seasons
        WHERE id=$1
        FOR SHARE`,
      [seasonId],
    );
    const seasonRow = season.rows[0];
    if (!seasonRow) {
      throw new BattlePassServiceError(
        "BATTLE_PASS_NOT_ACTIVE",
        "A Campanha informada não existe.",
        404,
      );
    }
    const now = Date.now();
    if (
      seasonRow.starts_at.getTime() > now ||
      seasonRow.claim_ends_at.getTime() < now
    ) {
      throw new BattlePassServiceError(
        "BATTLE_PASS_CLAIM_WINDOW_CLOSED",
        "As recompensas desta Campanha não podem ser coletadas neste momento.",
        409,
      );
    }

    const levelReached = await ensureAndLockProgress(client, userId, seasonId);
    const premiumAccess = await hasPremiumAccess(client, userId, seasonId);
    const rewards = await client.query<{ id: string }>(
      `SELECT reward.id
         FROM catalog.battle_pass_rewards reward
         LEFT JOIN progression.battle_pass_reward_claims claimed
           ON claimed.user_id=$2::uuid
          AND claimed.reward_id=reward.id
        WHERE reward.season_id=$1
          AND reward.level <= $3
          AND (reward.track='free' OR $4::boolean)
          AND claimed.reward_id IS NULL
        ORDER BY reward.level,
                 CASE reward.track WHEN 'free' THEN 0 ELSE 1 END,
                 reward.position,
                 reward.id`,
      [seasonId, userId, levelReached, premiumAccess],
    );

    const results: BattlePassClaimResult[] = [];
    for (const reward of rewards.rows) {
      results.push(
        await claimRewardInTransaction(client, userId, reward.id),
      );
    }

    await client.query("COMMIT");
    return {
      seasonId,
      rewards: results,
      claimedCount: results.filter((reward) => !reward.alreadyClaimed).length,
      creditAmount: results.reduce(
        (total, reward) => total + (reward.amount ?? 0),
        0,
      ),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
