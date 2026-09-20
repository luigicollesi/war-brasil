import "server-only";

import type { CosmeticSlot } from "@/src/lib/economy/economy-contract";
import type { EntitlementKind } from "@/src/lib/economy/entitlement-contract";
import type { EconomyQueryable } from "./economy-repository";

export type ProductEntitlementQuoteRow = {
  entitlement_kind: EntitlementKind;
  entitlement_id: string;
  cosmetic_id: string | null;
  title_id: string | null;
  background_id: string | null;
  slot: CosmeticSlot | null;
  available: boolean;
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

export async function lockProductEntitlementStats(
  productId: string,
  db: EconomyQueryable,
) {
  const cosmetic = await db.query<{ id: string }>(
    `SELECT stats.cosmetic_id AS id
       FROM catalog.product_entitlements membership
       JOIN catalog.cosmetic_stats stats
         ON stats.cosmetic_id=membership.cosmetic_id
      WHERE membership.product_id=$1
        AND membership.entitlement_kind='game_cosmetic'
      ORDER BY stats.cosmetic_id
      FOR UPDATE OF stats`,
    [productId],
  );

  const titles = await db.query<{ id: string }>(
    `SELECT stats.title_id AS id
       FROM catalog.product_entitlements membership
       JOIN catalog.commander_title_stats stats
         ON stats.title_id=membership.title_id
      WHERE membership.product_id=$1
        AND membership.entitlement_kind='commander_title'
      ORDER BY stats.title_id
      FOR UPDATE OF stats`,
    [productId],
  );

  const backgrounds = await db.query<{ id: string }>(
    `SELECT stats.background_id AS id
       FROM catalog.product_entitlements membership
       JOIN catalog.profile_background_stats stats
         ON stats.background_id=membership.background_id
      WHERE membership.product_id=$1
        AND membership.entitlement_kind='profile_background'
      ORDER BY stats.background_id
      FOR UPDATE OF stats`,
    [productId],
  );

  return [
    ...cosmetic.rows.map((row) => `game_cosmetic:${row.id}`),
    ...titles.rows.map((row) => `commander_title:${row.id}`),
    ...backgrounds.rows.map((row) => `profile_background:${row.id}`),
  ];
}

export async function listLockedProductEntitlementsForPurchase(
  userId: string,
  productId: string,
  db: EconomyQueryable,
): Promise<ProductEntitlementQuoteRow[]> {
  const result = await db.query<ProductEntitlementQuoteRow>(
    `SELECT *
       FROM (
         SELECT membership.entitlement_kind,
                item.id AS entitlement_id,
                item.id AS cosmetic_id,
                NULL::text AS title_id,
                NULL::text AS background_id,
                item.slot,
                (item.status='available') AS available,
                item.is_default,
                (owned.cosmetic_id IS NOT NULL) AS owned,
                pricing.pricing_model,
                pricing.fixed_price::text AS fixed_price,
                stats.acquisition_count::text AS acquisition_count,
                current_tier.acquisitions_from::text AS tier_from,
                current_tier.acquisitions_until::text AS tier_until,
                current_tier.price::text AS tier_price,
                membership.position
           FROM catalog.product_entitlements membership
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
          WHERE membership.product_id=$2
            AND membership.entitlement_kind='game_cosmetic'

         UNION ALL

         SELECT membership.entitlement_kind,
                title.id AS entitlement_id,
                NULL::text AS cosmetic_id,
                title.id AS title_id,
                NULL::text AS background_id,
                NULL::varchar AS slot,
                title.is_active AS available,
                FALSE AS is_default,
                (owned.title_id IS NOT NULL) AS owned,
                'fixed'::varchar AS pricing_model,
                pricing.fixed_price::text AS fixed_price,
                stats.acquisition_count::text AS acquisition_count,
                NULL::text AS tier_from,
                NULL::text AS tier_until,
                NULL::text AS tier_price,
                membership.position
           FROM catalog.product_entitlements membership
           JOIN catalog.commander_titles title ON title.id=membership.title_id
           JOIN catalog.commander_title_pricing pricing ON pricing.title_id=title.id
           JOIN catalog.commander_title_stats stats ON stats.title_id=title.id
           LEFT JOIN profile.commander_titles owned
             ON owned.user_id=$1::uuid
            AND owned.title_id=title.id
          WHERE membership.product_id=$2
            AND membership.entitlement_kind='commander_title'

         UNION ALL

         SELECT membership.entitlement_kind,
                background.id AS entitlement_id,
                NULL::text AS cosmetic_id,
                NULL::text AS title_id,
                background.id AS background_id,
                NULL::varchar AS slot,
                background.is_active AS available,
                background.is_default,
                (owned.background_id IS NOT NULL) AS owned,
                'fixed'::varchar AS pricing_model,
                pricing.fixed_price::text AS fixed_price,
                stats.acquisition_count::text AS acquisition_count,
                NULL::text AS tier_from,
                NULL::text AS tier_until,
                NULL::text AS tier_price,
                membership.position
           FROM catalog.product_entitlements membership
           JOIN catalog.profile_backgrounds background
             ON background.id=membership.background_id
           JOIN catalog.profile_background_pricing pricing
             ON pricing.background_id=background.id
           JOIN catalog.profile_background_stats stats
             ON stats.background_id=background.id
           LEFT JOIN profile.commander_backgrounds owned
             ON owned.user_id=$1::uuid
            AND owned.background_id=background.id
          WHERE membership.product_id=$2
            AND membership.entitlement_kind='profile_background'
       ) entitlement
      ORDER BY entitlement.position,entitlement.entitlement_kind,entitlement.entitlement_id`,
    [userId, productId],
  );

  return result.rows;
}

export async function insertPurchaseEntitlement(
  purchaseId: string,
  row: ProductEntitlementQuoteRow,
  unitPrice: number,
  db: EconomyQueryable,
) {
  await db.query(
    `INSERT INTO economy.purchase_entitlements(
       purchase_id,position,entitlement_kind,
       cosmetic_id,title_id,background_id,unit_price
     )
     VALUES($1::uuid,$2,$3,$4,$5,$6,$7::bigint)
     ON CONFLICT (purchase_id,position) DO NOTHING`,
    [
      purchaseId,
      row.position,
      row.entitlement_kind,
      row.cosmetic_id,
      row.title_id,
      row.background_id,
      unitPrice,
    ],
  );
}

export async function grantEntitlementOwnership(
  userId: string,
  row: ProductEntitlementQuoteRow,
  db: EconomyQueryable,
) {
  if (row.entitlement_kind === "game_cosmetic") {
    if (!row.cosmetic_id || !row.slot) return false;
    const result = await db.query(
      `INSERT INTO inventory.cosmetics(
         user_id,cosmetic_id,slot,acquisition_source
       )
       VALUES($1::uuid,$2,$3,'purchase')
       ON CONFLICT (user_id,cosmetic_id) DO NOTHING`,
      [userId, row.cosmetic_id, row.slot],
    );
    return (result.rowCount ?? 0) === 1;
  }

  if (row.entitlement_kind === "commander_title") {
    if (!row.title_id) return false;
    const result = await db.query(
      `INSERT INTO profile.commander_titles(
         user_id,title_id,acquisition_source
       )
       VALUES($1::uuid,$2,'purchase')
       ON CONFLICT (user_id,title_id) DO NOTHING`,
      [userId, row.title_id],
    );
    return (result.rowCount ?? 0) === 1;
  }

  if (!row.background_id) return false;
  const result = await db.query(
    `INSERT INTO profile.commander_backgrounds(
       user_id,background_id,acquisition_source
     )
     VALUES($1::uuid,$2,'purchase')
     ON CONFLICT (user_id,background_id) DO NOTHING`,
    [userId, row.background_id],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function insertLegacyCosmeticPurchaseItem(
  purchaseId: string,
  row: ProductEntitlementQuoteRow,
  unitPrice: number,
  db: EconomyQueryable,
) {
  if (row.entitlement_kind !== "game_cosmetic" || !row.cosmetic_id) return;
  await db.query(
    `INSERT INTO economy.purchase_items(purchase_id,cosmetic_id,unit_price)
     VALUES($1::uuid,$2,$3::bigint)
     ON CONFLICT (purchase_id,cosmetic_id) DO UPDATE
     SET unit_price=EXCLUDED.unit_price`,
    [purchaseId, row.cosmetic_id, unitPrice],
  );
}

export async function incrementEntitlementAcquisitionCount(
  row: ProductEntitlementQuoteRow,
  db: EconomyQueryable,
) {
  if (row.entitlement_kind === "game_cosmetic" && row.cosmetic_id) {
    const result = await db.query(
      `UPDATE catalog.cosmetic_stats
          SET acquisition_count=acquisition_count+1,
              updated_at=NOW()
        WHERE cosmetic_id=$1`,
      [row.cosmetic_id],
    );
    return (result.rowCount ?? 0) === 1;
  }

  if (row.entitlement_kind === "commander_title" && row.title_id) {
    const result = await db.query(
      `UPDATE catalog.commander_title_stats
          SET acquisition_count=acquisition_count+1,
              updated_at=NOW()
        WHERE title_id=$1`,
      [row.title_id],
    );
    return (result.rowCount ?? 0) === 1;
  }

  if (row.entitlement_kind === "profile_background" && row.background_id) {
    const result = await db.query(
      `UPDATE catalog.profile_background_stats
          SET acquisition_count=acquisition_count+1,
              updated_at=NOW()
        WHERE background_id=$1`,
      [row.background_id],
    );
    return (result.rowCount ?? 0) === 1;
  }

  return false;
}

export async function listPurchasedEntitlements(
  userId: string,
  purchaseId: string,
  db: EconomyQueryable,
) {
  const result = await db.query<{
    entitlement_kind: EntitlementKind;
    entitlement_id: string;
    unit_price: string;
  }>(
    `SELECT purchased.entitlement_kind,
            COALESCE(
              purchased.cosmetic_id,
              purchased.title_id,
              purchased.background_id
            ) AS entitlement_id,
            COALESCE(purchased.unit_price,0)::text AS unit_price
       FROM economy.purchase_entitlements purchased
       JOIN economy.purchases purchase ON purchase.id=purchased.purchase_id
      WHERE purchased.purchase_id=$1::uuid
        AND purchase.user_id=$2::uuid
      ORDER BY purchased.position`,
    [purchaseId, userId],
  );
  return result.rows;
}
