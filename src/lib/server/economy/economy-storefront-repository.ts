import "server-only";

import type {
  EconomyCreditPackStatus,
  EconomyOfferStatus,
} from "@/src/lib/economy/economy-contract";
import { pool } from "../db/pool";
import type {
  CosmeticRow,
  EconomyQueryable,
} from "./economy-repository";

export type StorefrontOfferRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  currency_code: "campaign-credit";
  price: string;
  status: EconomyOfferStatus;
  is_featured: boolean;
  sort_order: number;
};

export type StorefrontOfferItemRow = CosmeticRow & {
  offer_id: string;
  position: number;
};

export type CreditPackRow = {
  id: string;
  slug: string;
  name: string;
  credit_amount: string;
  price_brl_cents: string;
  status: EconomyCreditPackStatus;
  sort_order: number;
};

export async function listStorefrontOffers(
  db: EconomyQueryable = pool,
): Promise<StorefrontOfferRow[]> {
  const result = await db.query<StorefrontOfferRow>(
    `SELECT offer.id,
            offer.slug,
            offer.name,
            offer.description,
            offer.currency_code,
            offer.price::text AS price,
            offer.status,
            offer.is_featured,
            offer.sort_order
       FROM catalog.offers offer
      WHERE offer.status='available'
      ORDER BY offer.sort_order, offer.id`,
  );
  return result.rows;
}

export async function listStorefrontOfferItems(
  userId: string,
  db: EconomyQueryable = pool,
): Promise<StorefrontOfferItemRow[]> {
  const result = await db.query<StorefrontOfferItemRow>(
    `SELECT membership.offer_id,
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
       FROM catalog.offers offer
       JOIN catalog.offer_items membership ON membership.offer_id=offer.id
       JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
       LEFT JOIN inventory.cosmetics owned
         ON owned.user_id=$1::uuid
        AND owned.cosmetic_id=item.id
       LEFT JOIN profile.cosmetic_loadout loadout
         ON loadout.user_id=$1::uuid
        AND loadout.slot=item.slot
      WHERE offer.status='available'
      ORDER BY offer.sort_order, offer.id, membership.position`,
    [userId],
  );
  return result.rows;
}

export async function listStorefrontCreditPacks(
  db: EconomyQueryable = pool,
): Promise<CreditPackRow[]> {
  const result = await db.query<CreditPackRow>(
    `SELECT pack.id,
            pack.slug,
            pack.name,
            pack.credit_amount::text AS credit_amount,
            pack.price_brl_cents::text AS price_brl_cents,
            pack.status,
            pack.sort_order
       FROM catalog.credit_packs pack
      WHERE pack.status='announced'
      ORDER BY pack.sort_order, pack.id`,
  );
  return result.rows;
}
