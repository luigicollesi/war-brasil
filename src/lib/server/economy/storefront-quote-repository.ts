import "server-only";

import type { CosmeticSlot } from "@/src/lib/economy/economy-contract";
import { pool } from "../db/pool";
import type { EconomyQueryable } from "./economy-repository";

export type StorefrontOfferProductRow = {
  offer_id: string;
  product_id: string;
  collection_id: string | null;
  product_type: "single" | "bundle";
  bundle_discount_bps: number;
  promotion_discount_bps: number;
  currency_code: "campaign-credit";
  status: "draft" | "available" | "retired";
  active: boolean;
  available_now: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
};

export type StorefrontQuoteItemRow = {
  offer_id: string;
  product_id: string;
  cosmetic_id: string;
  slot: CosmeticSlot;
  status: "draft" | "announced" | "available" | "retired";
  is_default: boolean;
  owned: boolean;
  pricing_model: "fixed" | "progressive";
  fixed_price: string | null;
  acquisition_count: string;
  tier_from: string | null;
  tier_until: string | null;
  tier_price: string | null;
  position: number;
};

export async function listActiveStorefrontOfferProducts(
  db: EconomyQueryable = pool,
): Promise<StorefrontOfferProductRow[]> {
  const result = await db.query<StorefrontOfferProductRow>(
    `SELECT offer.id AS offer_id,
            offer.product_id,
            product.collection_id,
            product.product_type,
            product.bundle_discount_bps,
            COALESCE(collection.promotion_discount_bps, 0) AS promotion_discount_bps,
            offer.currency_code,
            offer.status,
            offer.active,
            TRUE AS available_now,
            offer.starts_at,
            offer.ends_at
       FROM catalog.offers offer
       JOIN catalog.products product ON product.id=offer.product_id
       LEFT JOIN catalog.collections collection ON collection.id=product.collection_id
      WHERE offer.status='available'
        AND offer.active=TRUE
        AND product.active=TRUE
        AND EXISTS (
          SELECT 1
            FROM catalog.product_items gameplay_membership
           WHERE gameplay_membership.product_id=product.id
        )
        AND (product.collection_id IS NULL OR collection.active=TRUE)
        AND (offer.starts_at IS NULL OR offer.starts_at <= CURRENT_TIMESTAMP)
        AND (offer.ends_at IS NULL OR offer.ends_at > CURRENT_TIMESTAMP)
      ORDER BY offer.priority, offer.sort_order, offer.id`,
  );
  return result.rows;
}

export async function listActiveStorefrontQuoteItems(
  userId: string,
  db: EconomyQueryable = pool,
): Promise<StorefrontQuoteItemRow[]> {
  const result = await db.query<StorefrontQuoteItemRow>(
    `SELECT offer.id AS offer_id,
            product.id AS product_id,
            item.id AS cosmetic_id,
            item.slot,
            item.status,
            item.is_default,
            (owned.cosmetic_id IS NOT NULL) AS owned,
            pricing.pricing_model,
            pricing.fixed_price::text AS fixed_price,
            stats.acquisition_count::text AS acquisition_count,
            current_tier.acquisitions_from::text AS tier_from,
            current_tier.acquisitions_until::text AS tier_until,
            current_tier.price::text AS tier_price,
            membership.position
       FROM catalog.offers offer
       JOIN catalog.products product ON product.id=offer.product_id
       LEFT JOIN catalog.collections collection ON collection.id=product.collection_id
       JOIN catalog.product_items membership ON membership.product_id=product.id
       JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
       JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
       JOIN catalog.cosmetic_stats stats ON stats.cosmetic_id=item.id
       LEFT JOIN inventory.cosmetics owned
         ON owned.user_id=$1::uuid
        AND owned.cosmetic_id=item.id
       LEFT JOIN LATERAL (
         SELECT tier.acquisitions_from,
                tier.acquisitions_until,
                tier.price
           FROM catalog.price_tiers tier
          WHERE tier.cosmetic_id=item.id
            AND pricing.pricing_model='progressive'
            AND stats.acquisition_count >= tier.acquisitions_from
            AND (
              tier.acquisitions_until IS NULL
              OR stats.acquisition_count <= tier.acquisitions_until
            )
          ORDER BY tier.acquisitions_from DESC
          LIMIT 1
       ) current_tier ON TRUE
      WHERE offer.status='available'
        AND offer.active=TRUE
        AND product.active=TRUE
        AND (product.collection_id IS NULL OR collection.active=TRUE)
        AND item.status='available'
        AND item.is_default=FALSE
        AND (offer.starts_at IS NULL OR offer.starts_at <= CURRENT_TIMESTAMP)
        AND (offer.ends_at IS NULL OR offer.ends_at > CURRENT_TIMESTAMP)
      ORDER BY offer.priority, offer.sort_order, offer.id, membership.position`,
    [userId],
  );
  return result.rows;
}


export async function listActiveStorefrontCategoryQuoteItems(
  userId: string,
  slots: ReadonlyArray<CosmeticSlot>,
  db: EconomyQueryable = pool,
): Promise<StorefrontQuoteItemRow[]> {
  const result = await db.query<StorefrontQuoteItemRow>(
    `SELECT offer.id AS offer_id,
            product.id AS product_id,
            item.id AS cosmetic_id,
            item.slot,
            item.status,
            item.is_default,
            (owned.cosmetic_id IS NOT NULL) AS owned,
            pricing.pricing_model,
            pricing.fixed_price::text AS fixed_price,
            stats.acquisition_count::text AS acquisition_count,
            current_tier.acquisitions_from::text AS tier_from,
            current_tier.acquisitions_until::text AS tier_until,
            current_tier.price::text AS tier_price,
            membership.position
       FROM catalog.offers offer
       JOIN catalog.products product ON product.id=offer.product_id
       JOIN catalog.product_items membership ON membership.product_id=product.id
       JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
       JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
       JOIN catalog.cosmetic_stats stats ON stats.cosmetic_id=item.id
       LEFT JOIN inventory.cosmetics owned
         ON owned.user_id=$1::uuid
        AND owned.cosmetic_id=item.id
       LEFT JOIN LATERAL (
         SELECT tier.acquisitions_from,
                tier.acquisitions_until,
                tier.price
           FROM catalog.price_tiers tier
          WHERE tier.cosmetic_id=item.id
            AND pricing.pricing_model='progressive'
            AND stats.acquisition_count >= tier.acquisitions_from
            AND (
              tier.acquisitions_until IS NULL
              OR stats.acquisition_count <= tier.acquisitions_until
            )
          ORDER BY tier.acquisitions_from DESC
          LIMIT 1
       ) current_tier ON TRUE
      WHERE offer.status='available'
        AND offer.active=TRUE
        AND product.active=TRUE
        AND product.collection_id IS NULL
        AND item.slot = ANY($2::varchar[])
        AND item.status='available'
        AND item.is_default=FALSE
        AND (offer.starts_at IS NULL OR offer.starts_at <= CURRENT_TIMESTAMP)
        AND (offer.ends_at IS NULL OR offer.ends_at > CURRENT_TIMESTAMP)
      ORDER BY offer.priority, offer.sort_order, offer.id, membership.position`,
    [userId, slots],
  );
  return result.rows;
}

export async function lockOfferProductForPurchase(
  offerId: string,
  db: EconomyQueryable,
): Promise<StorefrontOfferProductRow | null> {
  const result = await db.query<StorefrontOfferProductRow>(
    `SELECT offer.id AS offer_id,
            offer.product_id,
            product.collection_id,
            product.product_type,
            product.bundle_discount_bps,
            COALESCE(collection.promotion_discount_bps, 0) AS promotion_discount_bps,
            offer.currency_code,
            offer.status,
            offer.active,
            (
              offer.status='available'
              AND offer.active=TRUE
              AND product.active=TRUE
              AND (product.collection_id IS NULL OR collection.active=TRUE)
              AND (offer.starts_at IS NULL OR offer.starts_at <= CURRENT_TIMESTAMP)
              AND (offer.ends_at IS NULL OR offer.ends_at > CURRENT_TIMESTAMP)
            ) AS available_now,
            offer.starts_at,
            offer.ends_at
       FROM catalog.offers offer
       JOIN catalog.products product ON product.id=offer.product_id
       LEFT JOIN catalog.collections collection ON collection.id=product.collection_id
      WHERE offer.id=$1
      FOR UPDATE OF offer, product`,
    [offerId],
  );
  return result.rows[0] ?? null;
}

export async function lockStorefrontCollectionPromotion(
  collectionId: string | null,
  db: EconomyQueryable,
): Promise<number> {
  if (!collectionId) return 0;

  const result = await db.query<{ promotion_discount_bps: number }>(
    `SELECT collection.promotion_discount_bps
       FROM catalog.collections collection
      WHERE collection.id=$1
        AND collection.active=TRUE
      FOR SHARE`,
    [collectionId],
  );

  // The collection may have been deactivated after the offer/product lock but
  // before this row lock. Fail closed rather than purchasing an offer whose
  // authoritative collection is no longer active.
  if (result.rowCount !== 1) {
    throw new Error("Storefront collection became unavailable during purchase.");
  }
  return result.rows[0].promotion_discount_bps;
}

/**
 * Tier transitions serialize on the global cosmetic counters. Locks are always
 * acquired in cosmetic-id order so two overlapping bundles cannot deadlock by
 * touching the same counters in different product order.
 */
export async function lockProductCosmeticStats(
  productId: string,
  db: EconomyQueryable,
): Promise<string[]> {
  const result = await db.query<{ cosmetic_id: string }>(
    `SELECT stats.cosmetic_id
       FROM catalog.product_items membership
       JOIN catalog.cosmetic_stats stats ON stats.cosmetic_id=membership.cosmetic_id
      WHERE membership.product_id=$1
      ORDER BY stats.cosmetic_id
      FOR UPDATE OF stats`,
    [productId],
  );
  return result.rows.map((row) => row.cosmetic_id);
}

export async function listLockedProductQuoteItems(
  userId: string,
  offerId: string,
  productId: string,
  db: EconomyQueryable,
): Promise<StorefrontQuoteItemRow[]> {
  const result = await db.query<StorefrontQuoteItemRow>(
    `SELECT $2::text AS offer_id,
            product.id AS product_id,
            item.id AS cosmetic_id,
            item.slot,
            item.status,
            item.is_default,
            (owned.cosmetic_id IS NOT NULL) AS owned,
            pricing.pricing_model,
            pricing.fixed_price::text AS fixed_price,
            stats.acquisition_count::text AS acquisition_count,
            current_tier.acquisitions_from::text AS tier_from,
            current_tier.acquisitions_until::text AS tier_until,
            current_tier.price::text AS tier_price,
            membership.position
       FROM catalog.products product
       JOIN catalog.product_items membership ON membership.product_id=product.id
       JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
       JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
       JOIN catalog.cosmetic_stats stats ON stats.cosmetic_id=item.id
       LEFT JOIN inventory.cosmetics owned
         ON owned.user_id=$1::uuid
        AND owned.cosmetic_id=item.id
       LEFT JOIN LATERAL (
         SELECT tier.acquisitions_from,
                tier.acquisitions_until,
                tier.price
           FROM catalog.price_tiers tier
          WHERE tier.cosmetic_id=item.id
            AND pricing.pricing_model='progressive'
            AND stats.acquisition_count >= tier.acquisitions_from
            AND (
              tier.acquisitions_until IS NULL
              OR stats.acquisition_count <= tier.acquisitions_until
            )
          ORDER BY tier.acquisitions_from DESC
          LIMIT 1
       ) current_tier ON TRUE
      WHERE product.id=$3
      ORDER BY membership.position, item.id
      FOR SHARE OF membership, item, pricing`,
    [userId, offerId, productId],
  );
  return result.rows;
}

export async function incrementCosmeticAcquisitionCounts(
  cosmeticIds: ReadonlyArray<string>,
  db: EconomyQueryable,
): Promise<string[]> {
  if (cosmeticIds.length === 0) return [];

  const result = await db.query<{ cosmetic_id: string }>(
    `UPDATE catalog.cosmetic_stats stats
        SET acquisition_count=stats.acquisition_count+1,
            updated_at=NOW()
       FROM UNNEST($1::text[]) AS acquired(cosmetic_id)
      WHERE stats.cosmetic_id=acquired.cosmetic_id
      RETURNING stats.cosmetic_id`,
    [cosmeticIds],
  );
  return result.rows.map((row) => row.cosmetic_id);
}

export async function snapshotPurchaseCommercialContext(
  purchaseId: string,
  productId: string,
  subtotal: number,
  discountBps: number,
  promotionDiscountBps: number,
  db: EconomyQueryable,
) {
  await db.query(
    `UPDATE economy.purchases
        SET product_id=$2,
            subtotal_price=$3::bigint,
            discount_bps=$4::integer,
            promotion_discount_bps=$5::integer
      WHERE id=$1::uuid`,
    [purchaseId, productId, subtotal, discountBps, promotionDiscountBps],
  );
}

export async function snapshotPurchaseItemPrices(
  purchaseId: string,
  itemPrices: ReadonlyArray<Readonly<{ cosmeticId: string; unitPrice: number }>>,
  db: EconomyQueryable,
) {
  if (itemPrices.length === 0) return;

  await db.query(
    `UPDATE economy.purchase_items purchased
        SET unit_price=input.unit_price
       FROM UNNEST($2::text[], $3::bigint[]) AS input(cosmetic_id, unit_price)
      WHERE purchased.purchase_id=$1::uuid
        AND purchased.cosmetic_id=input.cosmetic_id`,
    [
      purchaseId,
      itemPrices.map((item) => item.cosmeticId),
      itemPrices.map((item) => item.unitPrice),
    ],
  );
}
