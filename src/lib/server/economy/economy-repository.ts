import "server-only";

import type { PoolClient } from "pg";
import type {
  CosmeticCatalogStatus,
  CosmeticSlot,
} from "@/src/lib/economy/economy-contract";
import { pool } from "../db/pool";

export type EconomyQueryable = Pick<PoolClient, "query">;

export type WalletRow = {
  currency_code: "campaign-credit";
  display_name: string;
  symbol: string;
  balance: string;
};

export type CosmeticRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  slot: CosmeticSlot;
  rarity: string | null;
  asset_ref: string | null;
  preview_ref: string | null;
  effect_key: string | null;
  status: CosmeticCatalogStatus;
  is_default: boolean;
  owned: boolean;
  equipped: boolean;
};

export type CosmeticSetItemRow = CosmeticRow & {
  set_id: string;
  set_slug: string;
  set_name: string;
  set_description: string | null;
  set_preview_ref: string | null;
  set_status: CosmeticCatalogStatus;
  position: number;
};

/**
 * Serializes economy/loadout mutations for one commander. The same commander
 * row is locked by match-start cosmetic capture so equip-vs-start has a clear
 * transaction boundary instead of producing a partially observed loadout.
 */
export async function lockCommanderEconomyState(
  userId: string,
  db: EconomyQueryable,
) {
  const result = await db.query<{ user_id: string }>(
    `SELECT user_id
       FROM profile.commanders
      WHERE user_id=$1::uuid
      FOR UPDATE`,
    [userId],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function initializeEconomyState(
  userId: string,
  db: EconomyQueryable,
) {
  await db.query(
    `INSERT INTO economy.wallets(user_id, currency_code, balance)
     VALUES($1::uuid, 'campaign-credit', 0)
     ON CONFLICT (user_id, currency_code) DO NOTHING`,
    [userId],
  );

  await db.query(
    `INSERT INTO inventory.cosmetics(user_id, cosmetic_id, slot, acquisition_source)
     SELECT $1::uuid, item.id, item.slot, 'default'
       FROM catalog.cosmetics item
      WHERE item.is_default=TRUE
     ON CONFLICT (user_id, cosmetic_id) DO NOTHING`,
    [userId],
  );

  await db.query(
    `INSERT INTO profile.cosmetic_loadout(user_id, slot, cosmetic_id)
     SELECT $1::uuid, item.slot, item.id
       FROM catalog.cosmetics item
      WHERE item.is_default=TRUE
     ON CONFLICT (user_id, slot) DO NOTHING`,
    [userId],
  );
}

export async function findCampaignCreditWallet(
  userId: string,
  db: EconomyQueryable = pool,
): Promise<WalletRow | null> {
  const result = await db.query<WalletRow>(
    `SELECT wallet.currency_code,
            currency.display_name,
            currency.symbol,
            wallet.balance::text AS balance
       FROM economy.wallets wallet
       JOIN economy.currencies currency ON currency.code=wallet.currency_code
      WHERE wallet.user_id=$1::uuid
        AND wallet.currency_code='campaign-credit'
        AND currency.is_active=TRUE`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function listOwnedCosmetics(
  userId: string,
  db: EconomyQueryable = pool,
): Promise<CosmeticRow[]> {
  const result = await db.query<CosmeticRow>(
    `SELECT item.id,
            item.slug,
            item.name,
            item.description,
            item.slot,
            item.rarity,
            item.asset_ref,
            item.preview_ref,
            item.effect_key,
            item.status,
            item.is_default,
            TRUE AS owned,
            (loadout.cosmetic_id=item.id) AS equipped
       FROM inventory.cosmetics owned
       JOIN catalog.cosmetics item ON item.id=owned.cosmetic_id
       LEFT JOIN profile.cosmetic_loadout loadout
         ON loadout.user_id=owned.user_id
        AND loadout.slot=owned.slot
      WHERE owned.user_id=$1::uuid
      ORDER BY item.slot, item.is_default DESC, item.name, item.id`,
    [userId],
  );
  return result.rows;
}

export async function listStorefrontSetItems(
  userId: string,
  db: EconomyQueryable = pool,
): Promise<CosmeticSetItemRow[]> {
  const result = await db.query<CosmeticSetItemRow>(
    `SELECT cosmetic_set.id AS set_id,
            cosmetic_set.slug AS set_slug,
            cosmetic_set.name AS set_name,
            cosmetic_set.description AS set_description,
            cosmetic_set.preview_ref AS set_preview_ref,
            cosmetic_set.status AS set_status,
            membership.position,
            item.id,
            item.slug,
            item.name,
            item.description,
            item.slot,
            item.rarity,
            item.asset_ref,
            item.preview_ref,
            item.effect_key,
            item.status,
            item.is_default,
            (owned.cosmetic_id IS NOT NULL) AS owned,
            (loadout.cosmetic_id=item.id) AS equipped
       FROM catalog.cosmetic_sets cosmetic_set
       JOIN catalog.cosmetic_set_items membership ON membership.set_id=cosmetic_set.id
       JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
       LEFT JOIN inventory.cosmetics owned
         ON owned.user_id=$1::uuid
        AND owned.cosmetic_id=item.id
       LEFT JOIN profile.cosmetic_loadout loadout
         ON loadout.user_id=$1::uuid
        AND loadout.slot=item.slot
      WHERE cosmetic_set.status IN ('announced', 'available')
        AND item.status IN ('announced', 'available')
      ORDER BY cosmetic_set.name, cosmetic_set.id, membership.position`,
    [userId],
  );
  return result.rows;
}

export async function findOwnedCosmetic(
  userId: string,
  cosmeticId: string,
  db: EconomyQueryable = pool,
): Promise<CosmeticRow | null> {
  const result = await db.query<CosmeticRow>(
    `SELECT item.id,
            item.slug,
            item.name,
            item.description,
            item.slot,
            item.rarity,
            item.asset_ref,
            item.preview_ref,
            item.effect_key,
            item.status,
            item.is_default,
            TRUE AS owned,
            (loadout.cosmetic_id=item.id) AS equipped
       FROM inventory.cosmetics owned
       JOIN catalog.cosmetics item ON item.id=owned.cosmetic_id
       LEFT JOIN profile.cosmetic_loadout loadout
         ON loadout.user_id=owned.user_id
        AND loadout.slot=owned.slot
      WHERE owned.user_id=$1::uuid
        AND owned.cosmetic_id=$2`,
    [userId, cosmeticId],
  );
  return result.rows[0] ?? null;
}

export async function equipOwnedCosmetic(
  userId: string,
  slot: CosmeticSlot,
  cosmeticId: string,
  db: EconomyQueryable = pool,
) {
  await db.query(
    `INSERT INTO profile.cosmetic_loadout AS current_loadout(
       user_id, slot, cosmetic_id, updated_at
     )
     VALUES($1::uuid, $2, $3, NOW())
     ON CONFLICT (user_id, slot) DO UPDATE
     SET cosmetic_id=EXCLUDED.cosmetic_id,
         updated_at=NOW()
     WHERE current_loadout.cosmetic_id IS DISTINCT FROM EXCLUDED.cosmetic_id`,
    [userId, slot, cosmeticId],
  );
}
