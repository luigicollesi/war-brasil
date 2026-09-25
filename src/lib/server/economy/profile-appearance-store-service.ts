import "server-only";

import type {
  ProfileAppearanceStoreItem,
  ProfileAppearanceStoreOffer,
  ProfileAppearanceStorefront,
} from "@/src/lib/economy/profile-appearance-store-contract";
import { quoteStorefrontProduct } from "@/src/lib/economy/storefront-pricing";
import { profileAppearanceAssetDeliveryPath } from "../profile/profile-appearance-asset-storage";
import {
  listActiveProfileAppearanceStoreRows,
  type ProfileAppearanceStoreRow,
} from "./profile-appearance-store-repository";

function positiveSafePrice(value: string) {
  const price = Number(value);
  if (!Number.isSafeInteger(price) || price <= 0) {
    throw new Error("PROFILE_APPEARANCE_PRICE_INVALID");
  }
  return price;
}

function storeItem(row: ProfileAppearanceStoreRow): ProfileAppearanceStoreItem {
  if (row.entitlement_kind === "commander_title") {
    if (!row.display_text || !row.font_key || !row.style_key) {
      throw new Error("PROFILE_TITLE_PRESENTATION_INVALID");
    }
    return {
      kind: "commander_title",
      id: row.entitlement_id,
      name: row.item_name,
      displayText: row.display_text,
      description: row.item_description,
      rarity: row.rarity,
      collectionId: row.collection_id,
      fontKey: row.font_key,
      styleKey: row.style_key,
      textureRef: row.texture_ref
        ? profileAppearanceAssetDeliveryPath(row.texture_ref)
        : null,
      owned: row.owned,
    };
  }

  if (!row.asset_ref) {
    throw new Error("PROFILE_BACKGROUND_ASSET_INVALID");
  }
  return {
    kind: "profile_background",
    id: row.entitlement_id,
    name: row.item_name,
    description: row.item_description,
    rarity: row.rarity,
    collectionId: row.collection_id,
    assetRef: profileAppearanceAssetDeliveryPath(row.asset_ref),
    previewRef: row.preview_ref
      ? profileAppearanceAssetDeliveryPath(row.preview_ref)
      : null,
    owned: row.owned,
  };
}

export async function getProfileAppearanceStorefront(
  userId: string,
): Promise<ProfileAppearanceStorefront> {
  const rows = await listActiveProfileAppearanceStoreRows(userId);
  const grouped = new Map<string, ProfileAppearanceStoreRow[]>();

  for (const row of rows) {
    const current = grouped.get(row.offer_id) ?? [];
    current.push(row);
    grouped.set(row.offer_id, current);
  }

  const offers: ProfileAppearanceStoreOffer[] = [];

  for (const offerRows of grouped.values()) {
    const first = offerRows[0];
    if (!first || offerRows.length !== first.product_entitlement_count) {
      // Mixed gameplay/profile products are intentionally left to the generic
      // storefront projection. This endpoint only exposes pure appearance offers.
      continue;
    }

    const quote = quoteStorefrontProduct(
      offerRows.map((row) => ({
        cosmeticId: `${row.entitlement_kind}:${row.entitlement_id}`,
        owned: row.owned,
        pricing: {
          type: "fixed" as const,
          price: positiveSafePrice(row.fixed_price),
        },
      })),
      first.bundle_discount_bps,
      first.promotion_discount_bps,
    );

    const ownedCount = offerRows.filter((row) => row.owned).length;
    offers.push({
      id: first.offer_id,
      productId: first.product_id,
      name: first.offer_name,
      description: first.offer_description,
      basePrice: quote.basePrice,
      promotionDiscountBps: quote.promotionDiscountBps,
      price: quote.finalPrice,
      ownedCount,
      totalCount: offerRows.length,
      fullyOwned: quote.fullyOwned,
      partiallyOwned: ownedCount > 0 && !quote.fullyOwned,
      purchasable: !quote.fullyOwned && quote.finalPrice > 0,
      items: offerRows.map(storeItem),
    });
  }

  return { offers };
}
