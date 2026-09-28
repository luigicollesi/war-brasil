import "server-only";

import type { PoolClient } from "pg";
import {
  BETA_TESTER_WELCOME_REWARD,
  type BetaTesterWelcomeRewardClaimResult,
  type BetaTesterWelcomeRewardState,
} from "@/src/lib/profile/beta-tester-welcome-reward";
import { ensureEconomyState } from "../economy/economy-service";
import { pool } from "../db/pool";

type RewardQueryable = Pick<PoolClient, "query">;

const CLAIM_KEY_PREFIX = "promotion:beta-tester-welcome:v1:";

function claimKey(userId: string) {
  return CLAIM_KEY_PREFIX + userId;
}

export class BetaTesterWelcomeRewardError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = "BetaTesterWelcomeRewardError";
  }
}

async function currentWalletBalance(userId: string, db: RewardQueryable) {
  const result = await db.query<{ balance: string }>(
    `SELECT balance::text AS balance
       FROM economy.wallets
      WHERE user_id=$1::uuid
        AND currency_code='campaign-credit'`,
    [userId],
  );
  const balance = Number(result.rows[0]?.balance ?? 0);
  return Number.isSafeInteger(balance) && balance >= 0 ? balance : 0;
}

export async function getBetaTesterWelcomeRewardState(
  userId: string,
  db: RewardQueryable = pool,
): Promise<BetaTesterWelcomeRewardState> {
  const key = claimKey(userId);
  const result = await db.query<{
    eligible: boolean;
    claimed: boolean;
  }>(
    `SELECT
       EXISTS(
         SELECT 1
           FROM profile.commanders commander
           JOIN profile.commander_titles owned
             ON owned.user_id=commander.user_id
            AND owned.title_id=$2
           JOIN catalog.commander_titles title
             ON title.id=owned.title_id
            AND title.is_active=TRUE
          WHERE commander.user_id=$1::uuid
            AND NULLIF(btrim(commander.handle),'') IS NOT NULL
            AND NULLIF(btrim(commander.display_name),'') IS NOT NULL
       ) AS eligible,
       EXISTS(
         SELECT 1
           FROM economy.ledger_entries ledger
          WHERE ledger.user_id=$1::uuid
            AND ledger.idempotency_key=$3
       ) AS claimed`,
    [userId, BETA_TESTER_WELCOME_REWARD.titleId, key],
  );

  const eligible = result.rows[0]?.eligible === true;
  const claimed = result.rows[0]?.claimed === true;
  return {
    eligible,
    claimed,
    pending: eligible && !claimed,
  };
}

export async function claimBetaTesterWelcomeReward(
  userId: string,
): Promise<BetaTesterWelcomeRewardClaimResult> {
  const client = await pool.connect();
  const key = claimKey(userId);
  const diceIds = BETA_TESTER_WELCOME_REWARD.dice.map((item) => item.id);

  try {
    await client.query("BEGIN");

    const commander = await client.query(
      `SELECT user_id
         FROM profile.commanders
        WHERE user_id=$1::uuid
          AND NULLIF(btrim(handle),'') IS NOT NULL
          AND NULLIF(btrim(display_name),'') IS NOT NULL
        FOR UPDATE`,
      [userId],
    );
    if (!commander.rowCount) {
      throw new BetaTesterWelcomeRewardError(
        "BETA_REWARD_PROFILE_INCOMPLETE",
        "Conclua sua identidade de comandante antes de receber a recompensa.",
        409,
      );
    }

    await ensureEconomyState(userId, client);

    const eligible = await client.query(
      `SELECT 1
         FROM profile.commander_titles owned
         JOIN catalog.commander_titles title
           ON title.id=owned.title_id
          AND title.is_active=TRUE
        WHERE owned.user_id=$1::uuid
          AND owned.title_id=$2
        LIMIT 1`,
      [userId, BETA_TESTER_WELCOME_REWARD.titleId],
    );
    if (!eligible.rowCount) {
      throw new BetaTesterWelcomeRewardError(
        "BETA_REWARD_NOT_ELIGIBLE",
        "Esta conta não possui a promoção Beta Tester.",
        403,
      );
    }

    const previousClaim = await client.query(
      `SELECT 1
         FROM economy.ledger_entries
        WHERE user_id=$1::uuid
          AND idempotency_key=$2
        LIMIT 1`,
      [userId, key],
    );
    if (previousClaim.rowCount) {
      const walletBalance = await currentWalletBalance(userId, client);
      await client.query("COMMIT");
      return {
        ok: true,
        alreadyClaimed: true,
        creditsGranted: 0,
        walletBalance,
        grantedCosmeticIds: [],
      };
    }

    const catalog = await client.query<{
      id: string;
      slot: string;
      status: string;
    }>(
      `SELECT id,slot,status
         FROM catalog.cosmetics
        WHERE id=ANY($1::text[])
        ORDER BY id
        FOR SHARE`,
      [diceIds],
    );

    const expectedSlots = new Map(
      BETA_TESTER_WELCOME_REWARD.dice.map((item) => [item.id, item.slot]),
    );
    const validCatalog =
      catalog.rows.length === diceIds.length &&
      catalog.rows.every(
        (item) =>
          item.status === "available" &&
          expectedSlots.get(item.id) === item.slot,
      );
    if (!validCatalog) {
      throw new BetaTesterWelcomeRewardError(
        "BETA_REWARD_CATALOG_INVALID",
        "A recompensa Beta Tester está temporariamente indisponível.",
        503,
      );
    }

    await client.query(
      `INSERT INTO catalog.cosmetic_stats(cosmetic_id,acquisition_count)
       SELECT id,0
         FROM catalog.cosmetics
        WHERE id=ANY($1::text[])
       ON CONFLICT (cosmetic_id) DO NOTHING`,
      [diceIds],
    );

    const granted = await client.query<{ cosmetic_id: string }>(
      `INSERT INTO inventory.cosmetics(
         user_id,cosmetic_id,slot,acquisition_source
       )
       SELECT $1::uuid,item.id,item.slot,'promotion'
         FROM catalog.cosmetics item
        WHERE item.id=ANY($2::text[])
       ON CONFLICT (user_id,cosmetic_id) DO NOTHING
       RETURNING cosmetic_id`,
      [userId, diceIds],
    );
    const grantedCosmeticIds = granted.rows.map((row) => row.cosmetic_id);

    if (grantedCosmeticIds.length > 0) {
      await client.query(
        `UPDATE catalog.cosmetic_stats
            SET acquisition_count=acquisition_count+1,
                updated_at=NOW()
          WHERE cosmetic_id=ANY($1::text[])`,
        [grantedCosmeticIds],
      );
    }

    const ledger = await client.query(
      `INSERT INTO economy.ledger_entries(
         user_id,
         currency_code,
         delta,
         reason,
         domain_reference,
         idempotency_key
       )
       VALUES(
         $1::uuid,
         'campaign-credit',
         $2::bigint,
         'promotion',
         $3,
         $4
       )
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        userId,
        BETA_TESTER_WELCOME_REWARD.credits,
        BETA_TESTER_WELCOME_REWARD.id,
        key,
      ],
    );

    if (!ledger.rowCount) {
      throw new BetaTesterWelcomeRewardError(
        "BETA_REWARD_ALREADY_CLAIMED",
        "A recompensa Beta Tester já foi recebida.",
        409,
      );
    }

    const wallet = await client.query<{ balance: string }>(
      `UPDATE economy.wallets
          SET balance=balance+$2::bigint,
              updated_at=NOW()
        WHERE user_id=$1::uuid
          AND currency_code='campaign-credit'
        RETURNING balance::text AS balance`,
      [userId, BETA_TESTER_WELCOME_REWARD.credits],
    );
    if (!wallet.rowCount) {
      throw new BetaTesterWelcomeRewardError(
        "BETA_REWARD_WALLET_MISSING",
        "Não foi possível creditar a recompensa agora.",
        503,
      );
    }

    const walletBalance = Number(wallet.rows[0].balance);
    if (!Number.isSafeInteger(walletBalance) || walletBalance < 0) {
      throw new BetaTesterWelcomeRewardError(
        "BETA_REWARD_WALLET_INVALID",
        "O saldo retornado para a recompensa é inválido.",
        503,
      );
    }

    await client.query("COMMIT");
    return {
      ok: true,
      alreadyClaimed: false,
      creditsGranted: BETA_TESTER_WELCOME_REWARD.credits,
      walletBalance,
      grantedCosmeticIds,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
