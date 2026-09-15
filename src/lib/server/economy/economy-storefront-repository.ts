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
  starts_at: string | null;
  ends_at: string | null;
};

export type StorefrontOfferItemRow = CosmeticRow & {
  offer_id: string;
  position: number;
};

export type StorefrontCollectionRow = CosmeticRow & {
  collection_id: string;
  collection_slug: string;
  collection_name: string;
  collection_description: string | null;
  collection_sort_order: number;
  banner_object_key: string;
  background_object_key: string;
  logo_object_key: string;
};

export type StorefrontCampaignRow = {
  campaign_id: string;
  campaign_slug: string;
  campaign_title: string;
  campaign_description: string | null;
  campaign_starts_at: string | null;
  campaign_ends_at: string | null;
  campaign_priority: number;
  offer_id: string;
  offer_position: number;
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

export async function listStorefrontCollections(
  userId: string,
  db: EconomyQueryable = pool,
): Promise<StorefrontCollectionRow[]> {
  const result = await db.query<StorefrontCollectionRow>(
    `WITH active_assets AS (
       SELECT asset.collection_id,
              MAX(asset.object_key) FILTER (WHERE asset.role='banner') AS banner_object_key,
              MAX(asset.object_key) FILTER (WHERE asset.role='background') AS background_object_key,
              MAX(asset.object_key) FILTER (WHERE asset.role='logo') AS logo_object_key,
              COUNT(*)::int AS asset_count
         FROM catalog.collection_assets asset
        WHERE asset.active=TRUE
        GROUP BY asset.collection_id
       HAVING COUNT(*) FILTER (WHERE asset.role='banner')=1
          AND COUNT(*) FILTER (WHERE asset.role='background')=1
          AND COUNT(*) FILTER (WHERE asset.role='logo')=1
          AND COUNT(*)=3
     )
     SELECT collection.id AS collection_id,
            collection.slug AS collection_slug,
            collection.name AS collection_name,
            collection.description AS collection_description,
            collection.sort_order AS collection_sort_order,
            assets.banner_object_key,
            assets.background_object_key,
            assets.logo_object_key,
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
       FROM catalog.collections collection
       JOIN active_assets assets ON assets.collection_id=collection.id
       JOIN catalog.cosmetics item ON item.collection_id=collection.id
       LEFT JOIN inventory.cosmetics owned
         ON owned.user_id=$1::uuid
        AND owned.cosmetic_id=item.id
       LEFT JOIN profile.cosmetic_loadout loadout
         ON loadout.user_id=$1::uuid
        AND loadout.slot=item.slot
      WHERE collection.active=TRUE
        AND item.is_default=FALSE
        AND item.status IN ('announced','available')
      ORDER BY collection.sort_order,
               collection.id,
               CASE item.slot
                 WHEN 'dice_attack' THEN 10
                 WHEN 'dice_defense' THEN 20
                 WHEN 'dice_neutral' THEN 30
                 WHEN 'territory_skin' THEN 40
                 ELSE 99
               END,
               item.id`,
    [userId],
  );
  return result.rows;
}

export async function listStorefrontTerritorySkins(
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
            (owned.cosmetic_id IS NOT NULL) AS owned,
            (loadout.cosmetic_id=item.id) AS equipped
       FROM catalog.cosmetics item
       LEFT JOIN inventory.cosmetics owned
         ON owned.user_id=$1::uuid
        AND owned.cosmetic_id=item.id
       LEFT JOIN profile.cosmetic_loadout loadout
         ON loadout.user_id=$1::uuid
        AND loadout.slot=item.slot
      WHERE item.slot='territory_skin'
        AND item.is_default=FALSE
        AND item.status IN ('announced','available')
      ORDER BY CASE item.status WHEN 'available' THEN 0 ELSE 1 END,
               item.name,
               item.id`,
    [userId],
  );
  return result.rows;
}

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
            offer.sort_order,
            offer.starts_at::text AS starts_at,
            offer.ends_at::text AS ends_at
       FROM catalog.offers offer
       JOIN catalog.products product ON product.id=offer.product_id
      WHERE offer.status='available'
        AND offer.active=TRUE
        AND product.active=TRUE
        AND (offer.starts_at IS NULL OR offer.starts_at <= CURRENT_TIMESTAMP)
        AND (offer.ends_at IS NULL OR offer.ends_at > CURRENT_TIMESTAMP)
      ORDER BY offer.priority, offer.sort_order, offer.id`,
  );
  return result.rows;
}

export async function listStorefrontOfferItems(
  userId: string,
  db: EconomyQueryable = pool,
): Promise<StorefrontOfferItemRow[]> {
  const result = await db.query<StorefrontOfferItemRow>(
    `SELECT offer.id AS offer_id,
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
       JOIN catalog.products product ON product.id=offer.product_id
       JOIN catalog.product_items membership ON membership.product_id=product.id
       JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
       LEFT JOIN inventory.cosmetics owned
         ON owned.user_id=$1::uuid
        AND owned.cosmetic_id=item.id
       LEFT JOIN profile.cosmetic_loadout loadout
         ON loadout.user_id=$1::uuid
        AND loadout.slot=item.slot
      WHERE offer.status='available'
        AND offer.active=TRUE
        AND product.active=TRUE
        AND (offer.starts_at IS NULL OR offer.starts_at <= CURRENT_TIMESTAMP)
        AND (offer.ends_at IS NULL OR offer.ends_at > CURRENT_TIMESTAMP)
      ORDER BY offer.priority, offer.sort_order, offer.id, membership.position`,
    [userId],
  );
  return result.rows;
}

export async function listStorefrontCampaigns(
  db: EconomyQueryable = pool,
): Promise<StorefrontCampaignRow[]> {
  const result = await db.query<StorefrontCampaignRow>(
    `SELECT campaign.id AS campaign_id,
            campaign.slug AS campaign_slug,
            campaign.title AS campaign_title,
            campaign.description AS campaign_description,
            campaign.starts_at::text AS campaign_starts_at,
            campaign.ends_at::text AS campaign_ends_at,
            campaign.priority AS campaign_priority,
            membership.offer_id,
            membership.position AS offer_position
       FROM catalog.campaigns campaign
       JOIN catalog.campaign_offers membership ON membership.campaign_id=campaign.id
       JOIN catalog.offers offer ON offer.id=membership.offer_id
       JOIN catalog.products product ON product.id=offer.product_id
      WHERE campaign.active=TRUE
        AND (campaign.starts_at IS NULL OR campaign.starts_at <= CURRENT_TIMESTAMP)
        AND (campaign.ends_at IS NULL OR campaign.ends_at > CURRENT_TIMESTAMP)
        AND offer.status='available'
        AND offer.active=TRUE
        AND product.active=TRUE
        AND (offer.starts_at IS NULL OR offer.starts_at <= CURRENT_TIMESTAMP)
        AND (offer.ends_at IS NULL OR offer.ends_at > CURRENT_TIMESTAMP)
      ORDER BY campaign.priority,
               campaign.id,
               membership.position,
               membership.offer_id`,
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
