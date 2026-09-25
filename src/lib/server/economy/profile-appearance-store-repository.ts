import "server-only";

import type { ProfileAppearanceRarity } from "@/src/lib/profile/profile-appearance-contract";
import { pool } from "../db/pool";
import type { EconomyQueryable } from "./economy-repository";

export type ProfileAppearanceStoreRow = {
  offer_id: string;
  product_id: string;
  offer_name: string;
  offer_description: string | null;
  bundle_discount_bps: number;
  promotion_discount_bps: number;
  product_entitlement_count: number;
  position: number;
  entitlement_kind: "commander_title" | "profile_background";
  entitlement_id: string;
  item_name: string;
  item_description: string | null;
  rarity: ProfileAppearanceRarity;
  collection_id: string | null;
  collection_name: string | null;
  collection_owned_count: number | null;
  collection_total_count: number | null;
  display_text: string | null;
  font_key: string | null;
  style_key: string | null;
  texture_ref: string | null;
  asset_ref: string | null;
  preview_ref: string | null;
  owned: boolean;
  fixed_price: string;
};

export async function listActiveProfileAppearanceStoreRows(
  userId: string,
  db: EconomyQueryable = pool,
): Promise<ProfileAppearanceStoreRow[]> {
  const result = await db.query<ProfileAppearanceStoreRow>(
    `WITH collection_progress AS (
         SELECT collection.id AS collection_id,
                collection.name AS collection_name,
                COUNT(item.id)::int AS total_count,
                COUNT(owned.cosmetic_id)::int AS owned_count
           FROM catalog.collections collection
           JOIN catalog.cosmetics item
             ON item.collection_id=collection.id
            AND item.is_default=FALSE
            AND item.status IN ('announced','available')
           LEFT JOIN inventory.cosmetics owned
             ON owned.user_id=$1::uuid
            AND owned.cosmetic_id=item.id
          GROUP BY collection.id,collection.name
       )
       SELECT *
       FROM (
         SELECT offer.id AS offer_id,
                product.id AS product_id,
                offer.name AS offer_name,
                offer.description AS offer_description,
                product.bundle_discount_bps,
                COALESCE(collection.promotion_discount_bps,0) AS promotion_discount_bps,
                (
                  SELECT COUNT(*)::int
                    FROM catalog.product_entitlements all_membership
                   WHERE all_membership.product_id=product.id
                ) AS product_entitlement_count,
                membership.position,
                membership.entitlement_kind,
                title.id AS entitlement_id,
                title.name AS item_name,
                title.description AS item_description,
                title.rarity,
                title.collection_id,
                NULL::text AS collection_name,
                NULL::int AS collection_owned_count,
                NULL::int AS collection_total_count,
                title.display_text,
                title.font_key,
                title.style_key,
                title.texture_ref,
                NULL::text AS asset_ref,
                NULL::text AS preview_ref,
                (owned.title_id IS NOT NULL) AS owned,
                pricing.fixed_price::text AS fixed_price
           FROM catalog.offers offer
           JOIN catalog.products product ON product.id=offer.product_id
           LEFT JOIN catalog.collections collection
             ON collection.id=product.collection_id
           JOIN catalog.product_entitlements membership
             ON membership.product_id=product.id
            AND membership.entitlement_kind='commander_title'
           JOIN catalog.commander_titles title ON title.id=membership.title_id
           JOIN catalog.commander_title_pricing pricing
             ON pricing.title_id=title.id
           LEFT JOIN profile.commander_titles owned
             ON owned.user_id=$1::uuid
            AND owned.title_id=title.id
          WHERE offer.status='available'
            AND offer.active=TRUE
            AND product.active=TRUE
            AND title.is_active=TRUE
            AND (product.collection_id IS NULL OR collection.active=TRUE)
            AND (offer.starts_at IS NULL OR offer.starts_at<=CURRENT_TIMESTAMP)
            AND (offer.ends_at IS NULL OR offer.ends_at>CURRENT_TIMESTAMP)

         UNION ALL

         SELECT offer.id AS offer_id,
                product.id AS product_id,
                offer.name AS offer_name,
                offer.description AS offer_description,
                product.bundle_discount_bps,
                COALESCE(collection.promotion_discount_bps,0) AS promotion_discount_bps,
                (
                  SELECT COUNT(*)::int
                    FROM catalog.product_entitlements all_membership
                   WHERE all_membership.product_id=product.id
                ) AS product_entitlement_count,
                membership.position,
                membership.entitlement_kind,
                background.id AS entitlement_id,
                background.name AS item_name,
                background.description AS item_description,
                background.rarity,
                background.collection_id,
                progress.collection_name,
                progress.owned_count AS collection_owned_count,
                progress.total_count AS collection_total_count,
                NULL::text AS display_text,
                NULL::text AS font_key,
                NULL::text AS style_key,
                NULL::text AS texture_ref,
                background.asset_ref,
                background.preview_ref,
                (owned.background_id IS NOT NULL) AS owned,
                pricing.fixed_price::text AS fixed_price
           FROM catalog.offers offer
           JOIN catalog.products product ON product.id=offer.product_id
           LEFT JOIN catalog.collections collection
             ON collection.id=product.collection_id
           JOIN catalog.product_entitlements membership
             ON membership.product_id=product.id
            AND membership.entitlement_kind='profile_background'
           JOIN catalog.profile_backgrounds background
             ON background.id=membership.background_id
           JOIN catalog.profile_background_pricing pricing
             ON pricing.background_id=background.id
           LEFT JOIN collection_progress progress
             ON progress.collection_id=background.collection_id
           LEFT JOIN profile.commander_backgrounds owned
             ON owned.user_id=$1::uuid
            AND owned.background_id=background.id
          WHERE offer.status='available'
            AND offer.active=TRUE
            AND product.active=TRUE
            AND background.is_active=TRUE
            AND background.is_default=FALSE
            AND (product.collection_id IS NULL OR collection.active=TRUE)
            AND (offer.starts_at IS NULL OR offer.starts_at<=CURRENT_TIMESTAMP)
            AND (offer.ends_at IS NULL OR offer.ends_at>CURRENT_TIMESTAMP)
       ) appearance
      ORDER BY appearance.offer_id,appearance.position,appearance.entitlement_id`,
    [userId],
  );
  return result.rows;
}
