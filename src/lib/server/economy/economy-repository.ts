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
  set_storage_slug: string | null;
  set_sort_order: number;
  position: number;
};

export type CatalogCosmeticAssetRow = {
  id: string;
  slot: CosmeticSlot;
  status: CosmeticCatalogStatus;
  asset_ref: string | null;
};

export type OfferRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  currency_code: "campaign-credit";
  price: string;
  status: "draft" | "available" | "retired";
  is_featured: boolean;
  sort_order: number;
};

export type PurchaseReceiptRow = {
  id: string;
  user_id: string;
  offer_id: string;
  currency_code: "campaign-credit";
  price_paid: string;
  idempotency_key: string;
  created_at: Date;
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

export async function lockCampaignCreditWallet(
  userId: string,
  db: EconomyQueryable,
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
        AND currency.is_active=TRUE
      FOR UPDATE OF wallet`,
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
            cosmetic_set.storage_slug AS set_storage_slug,
            cosmetic_set.sort_order AS set_sort_order,
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
      ORDER BY cosmetic_set.sort_order, cosmetic_set.id, membership.position`,
    [userId],
  );
  return result.rows;
}

export async function findCatalogCosmeticAsset(
  cosmeticId: string,
  db: EconomyQueryable = pool,
): Promise<CatalogCosmeticAssetRow | null> {
  const result = await db.query<CatalogCosmeticAssetRow>(
    `SELECT id,slot,status,asset_ref
       FROM catalog.cosmetics
      WHERE id=$1`,
    [cosmeticId],
  );
  return result.rows[0] ?? null;
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

export async function findPurchasableOffer(
  offerId: string,
  db: EconomyQueryable,
): Promise<OfferRow | null> {
  const result = await db.query<OfferRow>(
    `SELECT id,
            slug,
            name,
            description,
            currency_code,
            price::text AS price,
            status,
            is_featured,
            sort_order
       FROM catalog.offers
      WHERE id=$1
      FOR SHARE`,
    [offerId],
  );
  return result.rows[0] ?? null;
}

export async function listOfferItemsForPurchase(
  userId: string,
  offerId: string,
  db: EconomyQueryable,
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
            (owned.cosmetic_id IS NOT NULL) AS owned,
            (loadout.cosmetic_id=item.id) AS equipped
       FROM catalog.offer_items membership
       JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
       LEFT JOIN inventory.cosmetics owned
         ON owned.user_id=$1::uuid
        AND owned.cosmetic_id=item.id
       LEFT JOIN profile.cosmetic_loadout loadout
         ON loadout.user_id=$1::uuid
        AND loadout.slot=item.slot
      WHERE membership.offer_id=$2
      ORDER BY membership.position, item.id
      FOR SHARE OF membership, item`,
    [userId, offerId],
  );
  return result.rows;
}

export async function findPurchaseReceiptByIdempotencyKey(
  userId: string,
  idempotencyKey: string,
  db: EconomyQueryable,
): Promise<PurchaseReceiptRow | null> {
  const result = await db.query<PurchaseReceiptRow>(
    `SELECT id,
            user_id,
            offer_id,
            currency_code,
            price_paid::text AS price_paid,
            idempotency_key,
            created_at
       FROM economy.purchases
      WHERE user_id=$1::uuid
        AND idempotency_key=$2`,
    [userId, idempotencyKey],
  );
  return result.rows[0] ?? null;
}

export async function listPurchaseGrantedItems(
  userId: string,
  purchaseId: string,
  db: EconomyQueryable,
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
       FROM economy.purchases purchase
       JOIN economy.purchase_items purchased ON purchased.purchase_id=purchase.id
       JOIN catalog.cosmetics item ON item.id=purchased.cosmetic_id
       LEFT JOIN profile.cosmetic_loadout loadout
         ON loadout.user_id=purchase.user_id
        AND loadout.slot=item.slot
      WHERE purchase.id=$1::uuid
        AND purchase.user_id=$2::uuid
      ORDER BY item.slot, item.id`,
    [purchaseId, userId],
  );
  return result.rows;
}

export async function createPurchaseReceipt(
  purchaseId: string,
  userId: string,
  offerId: string,
  pricePaid: number,
  idempotencyKey: string,
  db: EconomyQueryable,
) {
  await db.query(
    `INSERT INTO economy.purchases(
       id, user_id, offer_id, currency_code, price_paid, idempotency_key
     )
     VALUES($1::uuid, $2::uuid, $3, 'campaign-credit', $4::bigint, $5)`,
    [purchaseId, userId, offerId, pricePaid, idempotencyKey],
  );
}

export async function debitCampaignCreditWallet(
  userId: string,
  amount: number,
  db: EconomyQueryable,
): Promise<string | null> {
  const result = await db.query<{ balance: string }>(
    `UPDATE economy.wallets
        SET balance=balance-$2::bigint,
            updated_at=NOW()
      WHERE user_id=$1::uuid
        AND currency_code='campaign-credit'
        AND balance >= $2::bigint
      RETURNING balance::text AS balance`,
    [userId, amount],
  );
  return result.rows[0]?.balance ?? null;
}

export async function insertPurchaseLedgerEntry(
  userId: string,
  purchaseId: string,
  amount: number,
  db: EconomyQueryable,
) {
  await db.query(
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
       -$3::bigint,
       'purchase',
       $2,
       'purchase:' || $2
     )`,
    [userId, purchaseId, amount],
  );
}

export async function grantPurchasedCosmetics(
  userId: string,
  purchaseId: string,
  items: ReadonlyArray<Pick<CosmeticRow, "id" | "slot">>,
  db: EconomyQueryable,
): Promise<string[]> {
  if (items.length === 0) return [];

  const cosmeticIds = items.map((item) => item.id);
  const slots = items.map((item) => item.slot);
  const ownership = await db.query<{ cosmetic_id: string }>(
    `INSERT INTO inventory.cosmetics(user_id, cosmetic_id, slot, acquisition_source)
     SELECT $1::uuid, input.cosmetic_id, input.slot, 'purchase'
       FROM UNNEST($2::text[], $3::varchar[]) AS input(cosmetic_id, slot)
     ON CONFLICT (user_id, cosmetic_id) DO NOTHING
     RETURNING cosmetic_id`,
    [userId, cosmeticIds, slots],
  );

  const grantedIds = ownership.rows.map((row) => row.cosmetic_id);
  if (grantedIds.length > 0) {
    await db.query(
      `INSERT INTO economy.purchase_items(purchase_id, cosmetic_id)
       SELECT $1::uuid, cosmetic_id
         FROM UNNEST($2::text[]) AS granted(cosmetic_id)
       ON CONFLICT (purchase_id, cosmetic_id) DO NOTHING`,
      [purchaseId, grantedIds],
    );
  }

  return grantedIds;
}
