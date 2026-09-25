import "server-only";

import { randomUUID } from "node:crypto";
import type {
  CampaignCreditWallet,
  CosmeticCatalogItem,
  CosmeticLoadout,
  CosmeticSet,
  CosmeticSlot,
  EconomyCreditPack,
  EconomyOffer,
  EconomyStorefrontSnapshot,
  EquipCosmeticInput,
  PurchaseOfferInput,
  PurchaseOfferResult,
  StorefrontCampaign,
  StorefrontCollection,
} from "@/src/lib/economy/economy-contract";
import {
  COSMETIC_SLOTS,
  ECONOMY_CURRENCY_ID,
  isCosmeticSlot,
} from "@/src/lib/economy/economy-contract";
import {
  quoteStorefrontProduct,
  resolveStorefrontUnitPrice,
  type StorefrontQuoteItem,
} from "@/src/lib/economy/storefront-pricing";
import { collectionAssetDeliveryPath } from "../assets/collection-asset-storage";
import {
  diceAssetDeliveryPath,
  territorySkinAssetDeliveryPath,
} from "../assets/asset-storage-service";
import { pool } from "../db/pool";
import {
  createPurchaseReceipt,
  debitCampaignCreditWallet,
  equipOwnedCosmetic,
  findCampaignCreditWallet,
  findOwnedCosmetic,
  findPurchaseReceiptByIdempotencyKey,
  initializeEconomyState,
  isEconomyStateInitialized,
  insertPurchaseLedgerEntry,
  listEquippedProfileCosmetics,
  listOwnedCosmetics,
  listPurchaseGrantedItems,
  listStorefrontSetItems,
  lockCampaignCreditWallet,
  lockCommanderEconomyState,
  type CosmeticRow,
  type EconomyQueryable,
  type WalletRow,
} from "./economy-repository";
import {
  listStorefrontCategoryOfferItems,
  listStorefrontCollections,
  listStorefrontOfferItems,
  listStorefrontTerritorySkins,
  type CreditPackRow,
  type StorefrontCampaignRow,
  type StorefrontCollectionRow,
  type StorefrontOfferItemRow,
  type StorefrontOfferRow,
} from "./economy-storefront-repository";
import {
  listActiveStorefrontCategoryQuoteItems,
  listActiveStorefrontQuoteItems,
  lockOfferProductForPurchase,
  lockStorefrontCollectionPromotion,
  snapshotPurchaseCommercialContext,
  type StorefrontOfferProductRow,
  type StorefrontQuoteItemRow,
} from "./storefront-quote-repository";
import { getStorefrontCatalogSnapshot } from "./storefront-catalog-cache";
import {
  grantEntitlementOwnership,
  incrementEntitlementAcquisitionCount,
  insertLegacyCosmeticPurchaseItem,
  insertPurchaseEntitlement,
  listBackgroundCollectionRequirementsForPurchase,
  listLockedProductEntitlementsForPurchase,
  listPurchasedEntitlements,
  lockProductEntitlementStats,
  type ProductEntitlementQuoteRow,
} from "./entitlement-repository";

export class EconomyServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "EconomyServiceError";
  }
}

function projectedCosmeticAssetRef(
  row: Pick<CosmeticRow, "slot">,
  assetRef: string | null,
) {
  if (!assetRef) return null;
  if (row.slot === "territory_skin") {
    return territorySkinAssetDeliveryPath(assetRef);
  }
  if (assetRef.startsWith("cosmetics/dice/")) {
    return diceAssetDeliveryPath(assetRef);
  }
  return assetRef;
}

function projectedAssetRef(row: CosmeticRow) {
  return projectedCosmeticAssetRef(row, row.asset_ref);
}

function cosmeticFromRow(row: CosmeticRow): CosmeticCatalogItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    slot: row.slot,
    rarity: row.rarity,
    status: row.status,
    isDefault: row.is_default,
    owned: row.owned,
    equipped: row.equipped,
    previewRef: projectedCosmeticAssetRef(row, row.preview_ref),
    assetRef: projectedAssetRef(row),
    effectKey: row.effect_key,
    bodyColor: row.body_color,
    bodyHighlightColor: row.body_highlight_color,
  };
}

function walletFromRow(row: WalletRow | null): CampaignCreditWallet {
  if (!row) {
    throw new EconomyServiceError(
      "ECONOMY_WALLET_MISSING",
      "A carteira do comandante não pôde ser inicializada.",
      503,
    );
  }

  const balance = Number(row.balance);
  if (!Number.isSafeInteger(balance) || balance < 0) {
    throw new EconomyServiceError(
      "ECONOMY_WALLET_INVALID",
      "O saldo persistido da carteira é inválido.",
      503,
    );
  }

  return {
    currency: ECONOMY_CURRENCY_ID,
    label: "Créditos de Campanha",
    shortLabel: "CRÉDITOS",
    symbol: "◈",
    balance,
  };
}

function integerAmount(value: string, errorCode: string, minimum: number) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < minimum) {
    throw new EconomyServiceError(
      errorCode,
      "O catálogo econômico contém um valor monetário inválido.",
      503,
    );
  }
  return amount;
}

function positiveAmount(value: string, errorCode: string) {
  return integerAmount(value, errorCode, 1);
}

function loadoutFromOwned(rows: CosmeticRow[]): CosmeticLoadout {
  const entries = COSMETIC_SLOTS.map((slot) => {
    const equipped = rows.find((row) => row.slot === slot && row.equipped);
    const fallback = rows.find((row) => row.slot === slot && row.is_default);
    const resolved = equipped ?? fallback;

    if (!resolved) {
      throw new EconomyServiceError(
        "ECONOMY_LOADOUT_INCOMPLETE",
        `Nenhum cosmético seguro está disponível para o slot ${slot}.`,
        503,
      );
    }

    return [slot, cosmeticFromRow(resolved)] as const;
  });

  return Object.fromEntries(entries) as unknown as CosmeticLoadout;
}

function setsFromRows(
  rows: Awaited<ReturnType<typeof listStorefrontSetItems>>,
): CosmeticSet[] {
  const grouped = new Map<string, CosmeticSet>();

  for (const row of rows) {
    const current = grouped.get(row.set_id);
    const item = cosmeticFromRow(row);
    if (current) {
      grouped.set(row.set_id, { ...current, items: [...current.items, item] });
      continue;
    }

    grouped.set(row.set_id, {
      id: row.set_id,
      slug: row.set_slug,
      name: row.set_name,
      description: row.set_description,
      status: row.set_status,
      previewRef: row.set_preview_ref,
      items: [item],
    });
  }

  return [...grouped.values()];
}

function collectionsFromRows(
  rows: StorefrontCollectionRow[],
  productRows: StorefrontOfferProductRow[],
): StorefrontCollection[] {
  const grouped = new Map<
    string,
    Omit<StorefrontCollection, "offerIds" | "singleOfferIds" | "bundleOfferIds">
  >();

  for (const row of rows) {
    const current = grouped.get(row.collection_id);
    const item = cosmeticFromRow(row);
    if (current) {
      grouped.set(row.collection_id, {
        ...current,
        items: [...current.items, item],
        ownedCount: current.ownedCount + (item.owned ? 1 : 0),
        totalCount: current.totalCount + 1,
        fullyOwned: current.fullyOwned && item.owned,
        partiallyOwned: false,
      });
      continue;
    }

    grouped.set(row.collection_id, {
      id: row.collection_id,
      slug: row.collection_slug,
      name: row.collection_name,
      description: row.collection_description,
      featured: row.collection_featured,
      promotionDiscountBps: row.collection_promotion_discount_bps,
      assets: {
        banner: collectionAssetDeliveryPath(row.banner_object_key),
        background: collectionAssetDeliveryPath(row.background_object_key),
        logo: collectionAssetDeliveryPath(row.logo_object_key),
      },
      items: [item],
      ownedCount: item.owned ? 1 : 0,
      totalCount: 1,
      fullyOwned: item.owned,
      partiallyOwned: false,
    });
  }

  const offersByCollection = new Map<
    string,
    { all: string[]; singles: string[]; bundles: string[] }
  >();
  for (const product of productRows) {
    if (!product.collection_id) continue;
    const current = offersByCollection.get(product.collection_id) ?? {
      all: [],
      singles: [],
      bundles: [],
    };
    current.all.push(product.offer_id);
    if (product.product_type === "single") current.singles.push(product.offer_id);
    else current.bundles.push(product.offer_id);
    offersByCollection.set(product.collection_id, current);
  }

  return [...grouped.values()].map((collection) => {
    const offers = offersByCollection.get(collection.id) ?? {
      all: [],
      singles: [],
      bundles: [],
    };
    const fullyOwned =
      collection.totalCount > 0 && collection.ownedCount === collection.totalCount;
    return {
      ...collection,
      fullyOwned,
      partiallyOwned: collection.ownedCount > 0 && !fullyOwned,
      offerIds: offers.all,
      singleOfferIds: offers.singles,
      bundleOfferIds: offers.bundles,
    };
  });
}

function campaignsFromRows(rows: StorefrontCampaignRow[]): StorefrontCampaign[] {
  const grouped = new Map<string, StorefrontCampaign>();

  for (const row of rows) {
    const current = grouped.get(row.campaign_id);
    if (current) {
      grouped.set(row.campaign_id, {
        ...current,
        offerIds: [...current.offerIds, row.offer_id],
      });
      continue;
    }

    grouped.set(row.campaign_id, {
      id: row.campaign_id,
      slug: row.campaign_slug,
      title: row.campaign_title,
      description: row.campaign_description,
      startsAt: row.campaign_starts_at,
      endsAt: row.campaign_ends_at,
      offerIds: [row.offer_id],
    });
  }

  return [...grouped.values()];
}

function quoteItemFromRow(row: StorefrontQuoteItemRow): StorefrontQuoteItem {
  const acquisitionCount = integerAmount(
    row.acquisition_count,
    "ECONOMY_CATALOG_INVALID",
    0,
  );

  if (row.pricing_model === "fixed") {
    if (row.fixed_price === null) {
      throw new EconomyServiceError(
        "ECONOMY_CATALOG_INVALID",
        "Um cosmético de preço fixo está sem preço configurado.",
        503,
      );
    }
    return {
      cosmeticId: row.cosmetic_id,
      owned: row.owned,
      pricing: {
        type: "fixed",
        price: positiveAmount(row.fixed_price, "ECONOMY_CATALOG_INVALID"),
      },
    };
  }

  if (row.tier_from === null || row.tier_price === null) {
    throw new EconomyServiceError(
      "ECONOMY_CATALOG_INVALID",
      "Um cosmético progressivo não possui tier para o contador atual.",
      503,
    );
  }

  return {
    cosmeticId: row.cosmetic_id,
    owned: row.owned,
    pricing: {
      type: "progressive",
      acquisitionCount,
      tiers: [
        {
          acquisitionsFrom: integerAmount(
            row.tier_from,
            "ECONOMY_CATALOG_INVALID",
            0,
          ),
          acquisitionsUntil:
            row.tier_until === null
              ? null
              : integerAmount(
                  row.tier_until,
                  "ECONOMY_CATALOG_INVALID",
                  0,
                ),
          price: positiveAmount(row.tier_price, "ECONOMY_CATALOG_INVALID"),
        },
      ],
    },
  };
}

function quoteFromRows(
  rows: ReadonlyArray<StorefrontQuoteItemRow>,
  discountBps: number,
  promotionDiscountBps = 0,
) {
  try {
    return quoteStorefrontProduct(
      rows.map(quoteItemFromRow),
      discountBps,
      promotionDiscountBps,
    );
  } catch (error) {
    if (error instanceof EconomyServiceError) throw error;
    throw new EconomyServiceError(
      "ECONOMY_CATALOG_INVALID",
      "A configuração de preço da loja é inválida.",
      503,
    );
  }
}

function quoteEntitlementFromRow(
  row: ProductEntitlementQuoteRow,
): StorefrontQuoteItem {
  const acquisitionCount = integerAmount(
    row.acquisition_count,
    "ECONOMY_CATALOG_INVALID",
    0,
  );
  const entitlementKey = `${row.entitlement_kind}:${row.entitlement_id}`;

  if (row.pricing_model === "fixed") {
    if (row.fixed_price === null) {
      throw new EconomyServiceError(
        "ECONOMY_CATALOG_INVALID",
        "Um entitlement de preço fixo está sem preço configurado.",
        503,
      );
    }
    return {
      cosmeticId: entitlementKey,
      owned: row.owned,
      pricing: {
        type: "fixed",
        price: positiveAmount(row.fixed_price, "ECONOMY_CATALOG_INVALID"),
      },
    };
  }

  if (row.tier_from === null || row.tier_price === null) {
    throw new EconomyServiceError(
      "ECONOMY_CATALOG_INVALID",
      "Um entitlement progressivo não possui tier para o contador atual.",
      503,
    );
  }

  return {
    cosmeticId: entitlementKey,
    owned: row.owned,
    pricing: {
      type: "progressive",
      acquisitionCount,
      tiers: [
        {
          acquisitionsFrom: integerAmount(
            row.tier_from,
            "ECONOMY_CATALOG_INVALID",
            0,
          ),
          acquisitionsUntil:
            row.tier_until === null
              ? null
              : integerAmount(
                  row.tier_until,
                  "ECONOMY_CATALOG_INVALID",
                  0,
                ),
          price: positiveAmount(row.tier_price, "ECONOMY_CATALOG_INVALID"),
        },
      ],
    },
  };
}

function quoteEntitlements(
  rows: ReadonlyArray<ProductEntitlementQuoteRow>,
  discountBps: number,
  promotionDiscountBps: number,
) {
  try {
    return quoteStorefrontProduct(
      rows.map(quoteEntitlementFromRow),
      discountBps,
      promotionDiscountBps,
    );
  } catch (error) {
    if (error instanceof EconomyServiceError) throw error;
    throw new EconomyServiceError(
      "ECONOMY_CATALOG_INVALID",
      "A configuração econômica dos entitlements é inválida.",
      503,
    );
  }
}

function entitlementUnitPrice(row: ProductEntitlementQuoteRow) {
  try {
    return resolveStorefrontUnitPrice(quoteEntitlementFromRow(row).pricing);
  } catch (error) {
    if (error instanceof EconomyServiceError) throw error;
    throw new EconomyServiceError(
      "ECONOMY_CATALOG_INVALID",
      "O preço unitário do entitlement é inválido.",
      503,
    );
  }
}

function offersFromRows(
  offerRows: StorefrontOfferRow[],
  itemRows: StorefrontOfferItemRow[],
  productRows: StorefrontOfferProductRow[],
  quoteRows: StorefrontQuoteItemRow[],
): EconomyOffer[] {
  const itemsByOffer = new Map<string, CosmeticCatalogItem[]>();
  for (const row of itemRows) {
    const current = itemsByOffer.get(row.offer_id) ?? [];
    current.push(cosmeticFromRow(row));
    itemsByOffer.set(row.offer_id, current);
  }

  const productByOffer = new Map(productRows.map((row) => [row.offer_id, row]));
  const quoteRowsByOffer = new Map<string, StorefrontQuoteItemRow[]>();
  for (const row of quoteRows) {
    const current = quoteRowsByOffer.get(row.offer_id) ?? [];
    current.push(row);
    quoteRowsByOffer.set(row.offer_id, current);
  }

  return offerRows.map((row) => {
    const items = itemsByOffer.get(row.id) ?? [];
    const product = productByOffer.get(row.id);
    const pricingItems = quoteRowsByOffer.get(row.id) ?? [];
    if (!product || items.length === 0 || pricingItems.length !== items.length) {
      throw new EconomyServiceError(
        "ECONOMY_CATALOG_INVALID",
        "A composição comercial da oferta está inconsistente.",
        503,
      );
    }

    const quote = quoteFromRows(
      pricingItems,
      product.bundle_discount_bps,
      product.promotion_discount_bps,
    );
    const ownedCount = items.filter((item) => item.owned).length;
    const totalCount = items.length;
    const fullyOwned = totalCount > 0 && ownedCount === totalCount;
    const partiallyOwned = ownedCount > 0 && !fullyOwned;
    const catalogEligible = items.every(
      (item) => item.status === "available" && !item.isDefault,
    );

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      currency: ECONOMY_CURRENCY_ID,
      basePrice: quote.basePrice,
      promotionDiscountBps: quote.promotionDiscountBps,
      price: quote.finalPrice,
      status: row.status,
      featured: row.is_featured,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      items,
      ownedCount,
      totalCount,
      fullyOwned,
      partiallyOwned,
      purchasable:
        row.status === "available" &&
        product.available_now &&
        catalogEligible &&
        !quote.fullyOwned,
    };
  });
}

function creditPacksFromRows(rows: CreditPackRow[]): EconomyCreditPack[] {
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    creditAmount: positiveAmount(row.credit_amount, "ECONOMY_CATALOG_INVALID"),
    priceBrlCents: positiveAmount(row.price_brl_cents, "ECONOMY_CATALOG_INVALID"),
    status: row.status,
  }));
}

async function ensureLockedEconomyState(userId: string, db: EconomyQueryable) {
  const commanderExists = await lockCommanderEconomyState(userId, db);
  if (!commanderExists) {
    throw new EconomyServiceError(
      "ECONOMY_COMMANDER_MISSING",
      "A identidade de comandante precisa existir antes da economia.",
      409,
    );
  }
  await initializeEconomyState(userId, db);
}

export async function ensureEconomyState(userId: string, db?: EconomyQueryable) {
  if (db) {
    await ensureLockedEconomyState(userId, db);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureLockedEconomyState(userId, client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureEconomyStateForRead(userId: string) {
  if (await isEconomyStateInitialized(userId)) return;
  await ensureEconomyState(userId);
}

export async function getEconomyLoadout(
  userId: string,
): Promise<CosmeticLoadout> {
  await ensureEconomyStateForRead(userId);
  return loadoutFromOwned(await listEquippedProfileCosmetics(userId));
}

export async function getEconomyWallet(
  userId: string,
): Promise<CampaignCreditWallet> {
  const existing = await findCampaignCreditWallet(userId);
  if (existing) return walletFromRow(existing);

  await ensureEconomyState(userId);
  return walletFromRow(await findCampaignCreditWallet(userId));
}

export type EconomyStoreCategorySnapshot = Readonly<{
  wallet: CampaignCreditWallet;
  offers: ReadonlyArray<EconomyOffer>;
  territorySkins: ReadonlyArray<CosmeticCatalogItem>;
}>;

export async function getEconomyStoreCategory(
  userId: string,
  category: "dice" | "territories",
): Promise<EconomyStoreCategorySnapshot> {
  await ensureEconomyStateForRead(userId);

  const slots: ReadonlyArray<CosmeticSlot> =
    category === "dice"
      ? ["dice_attack", "dice_defense", "dice_neutral"]
      : ["territory_skin"];

  const userRowsPromise = Promise.all([
    findCampaignCreditWallet(userId),
    listStorefrontCategoryOfferItems(userId, slots),
    listActiveStorefrontCategoryQuoteItems(userId, slots),
    category === "territories" ? listStorefrontTerritorySkins(userId) : Promise.resolve([]),
  ]);
  const catalogPromise = getStorefrontCatalogSnapshot();

  const [[walletRow, offerItemRows, quoteRows, territorySkinRows], catalog] =
    await Promise.all([userRowsPromise, catalogPromise]);

  const categoryOfferIds = new Set(offerItemRows.map((row) => row.offer_id));
  const categoryProductRows = catalog.productRows.filter(
    (product) =>
      product.collection_id === null && categoryOfferIds.has(product.offer_id),
  );

  const projectOffers = (offerRows: StorefrontOfferRow[]) =>
    offersFromRows(
      offerRows.filter((offer) => categoryOfferIds.has(offer.id)),
      offerItemRows,
      categoryProductRows,
      quoteRows.filter((row) => categoryOfferIds.has(row.offer_id)),
    );

  let offers: EconomyOffer[];
  try {
    offers = projectOffers(catalog.offerRows);
  } catch (error) {
    if (
      !(error instanceof EconomyServiceError) ||
      error.code !== "ECONOMY_CATALOG_INVALID"
    ) {
      throw error;
    }

    const refreshed = await getStorefrontCatalogSnapshot({ bypassCache: true });
    const refreshedProducts = refreshed.productRows.filter(
      (product) =>
        product.collection_id === null && categoryOfferIds.has(product.offer_id),
    );
    offers = offersFromRows(
      refreshed.offerRows.filter((offer) => categoryOfferIds.has(offer.id)),
      offerItemRows,
      refreshedProducts,
      quoteRows.filter((row) => categoryOfferIds.has(row.offer_id)),
    );
  }

  const categoryOffers = offers.filter((offer) =>
    offer.items.length > 0 &&
    offer.items.every((item) =>
      category === "dice"
        ? item.slot === "dice_attack" ||
          item.slot === "dice_defense" ||
          item.slot === "dice_neutral"
        : item.slot === "territory_skin",
    ),
  );

  return {
    wallet: walletFromRow(walletRow),
    offers: categoryOffers,
    territorySkins:
      category === "territories" ? territorySkinRows.map(cosmeticFromRow) : [],
  };
}

export async function getEconomyStorefront(
  userId: string,
): Promise<EconomyStorefrontSnapshot> {
  await ensureEconomyStateForRead(userId);

  const userOverlayPromise = Promise.all([
    findCampaignCreditWallet(userId),
    listOwnedCosmetics(userId),
    listStorefrontSetItems(userId),
    listStorefrontCollections(userId),
    listStorefrontTerritorySkins(userId),
    listStorefrontOfferItems(userId),
    listActiveStorefrontQuoteItems(userId),
  ]);

  const catalogPromise = getStorefrontCatalogSnapshot();

  const [
    [
      walletRow,
      ownedRows,
      setRows,
      collectionRows,
      territorySkinRows,
      offerItemRows,
      quoteRows,
    ],
    catalog,
  ] = await Promise.all([userOverlayPromise, catalogPromise]);

  let activeCatalog = catalog;
  let offers: EconomyOffer[];
  try {
    offers = offersFromRows(
      activeCatalog.offerRows,
      offerItemRows,
      activeCatalog.productRows,
      quoteRows,
    );
  } catch (error) {
    if (
      !(error instanceof EconomyServiceError) ||
      error.code !== "ECONOMY_CATALOG_INVALID"
    ) {
      throw error;
    }

    activeCatalog = await getStorefrontCatalogSnapshot({ bypassCache: true });
    offers = offersFromRows(
      activeCatalog.offerRows,
      offerItemRows,
      activeCatalog.productRows,
      quoteRows,
    );
  }

  return {
    wallet: walletFromRow(walletRow),
    loadout: loadoutFromOwned(ownedRows),
    ownedItems: ownedRows.map(cosmeticFromRow),
    sets: setsFromRows(setRows),
    collections: collectionsFromRows(collectionRows, activeCatalog.productRows),
    campaigns: campaignsFromRows(activeCatalog.campaignRows),
    territorySkins: territorySkinRows.map(cosmeticFromRow),
    offers,
    creditPacks: creditPacksFromRows(activeCatalog.creditPackRows),
  } satisfies EconomyStorefrontSnapshot;
}

export function parseEquipCosmeticInput(payload: unknown): EquipCosmeticInput {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new EconomyServiceError(
      "ECONOMY_INVALID_SELECTION",
      "Seleção de cosmético inválida.",
      400,
    );
  }

  const input = payload as Record<string, unknown>;
  const cosmeticId = typeof input.cosmeticId === "string" ? input.cosmeticId.trim() : "";
  if (!isCosmeticSlot(input.slot) || !cosmeticId || cosmeticId.length > 160) {
    throw new EconomyServiceError(
      "ECONOMY_INVALID_SELECTION",
      "Slot ou cosmético inválido.",
      400,
    );
  }

  return { slot: input.slot, cosmeticId };
}

export function parsePurchaseOfferInput(payload: unknown): PurchaseOfferInput {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new EconomyServiceError(
      "ECONOMY_INVALID_PURCHASE",
      "Solicitação de compra inválida.",
      400,
    );
  }

  const input = payload as Record<string, unknown>;
  const keys = Object.keys(input);
  const hasOnlyAllowedFields =
    keys.length === 3 &&
    keys.every(
      (key) =>
        key === "offerId" || key === "idempotencyKey" || key === "expectedPrice",
    );
  const offerId = typeof input.offerId === "string" ? input.offerId.trim() : "";
  const idempotencyKey =
    typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim() : "";
  const expectedPrice = input.expectedPrice;

  if (
    !hasOnlyAllowedFields ||
    !offerId ||
    offerId.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey) ||
    !Number.isSafeInteger(expectedPrice) ||
    (expectedPrice as number) < 0
  ) {
    throw new EconomyServiceError(
      "ECONOMY_INVALID_PURCHASE",
      "Offer, preço esperado ou chave de idempotência inválida.",
      400,
    );
  }

  return { offerId, idempotencyKey, expectedPrice: expectedPrice as number };
}

export async function purchaseOffer(
  userId: string,
  offerId: string,
  idempotencyKey: string,
  expectedPrice: number,
): Promise<PurchaseOfferResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureLockedEconomyState(userId, client);

    const lockedWallet = await lockCampaignCreditWallet(userId, client);
    const wallet = walletFromRow(lockedWallet);

    const existing = await findPurchaseReceiptByIdempotencyKey(
      userId,
      idempotencyKey,
      client,
    );
    if (existing) {
      if (existing.offer_id !== offerId) {
        throw new EconomyServiceError(
          "ECONOMY_IDEMPOTENCY_CONFLICT",
          "A chave de idempotência já foi usada em outra compra.",
          409,
        );
      }

      const [acquiredRows, entitlementRows] = await Promise.all([
        listPurchaseGrantedItems(userId, existing.id, client),
        listPurchasedEntitlements(userId, existing.id, client),
      ]);
      const result = {
        purchaseId: existing.id,
        wallet,
        acquiredItems: acquiredRows.map(cosmeticFromRow),
        acquiredEntitlements: entitlementRows.map((row) => ({
          kind: row.entitlement_kind,
          id: row.entitlement_id,
          unitPrice: Number(row.unit_price),
        })),
        offer: {
          id: existing.offer_id,
          ownedCount: existing.offer_item_count,
          totalCount: existing.offer_item_count,
          fullyOwned: true,
        },
      } satisfies PurchaseOfferResult;
      await client.query("COMMIT");
      return result;
    }

    const offer = await lockOfferProductForPurchase(offerId, client);
    if (!offer) {
      throw new EconomyServiceError(
        "ECONOMY_OFFER_NOT_FOUND",
        "A oferta solicitada não existe.",
        404,
      );
    }
    if (!offer.available_now) {
      throw new EconomyServiceError(
        "ECONOMY_OFFER_UNAVAILABLE",
        "A oferta não está disponível para compra.",
        409,
      );
    }
    if (offer.currency_code !== ECONOMY_CURRENCY_ID) {
      throw new EconomyServiceError(
        "ECONOMY_CATALOG_INVALID",
        "A oferta possui configuração econômica inválida.",
        503,
      );
    }

    const promotionDiscountBps = await lockStorefrontCollectionPromotion(
      offer.collection_id,
      client,
    );
    const lockedStats = await lockProductEntitlementStats(
      offer.product_id,
      client,
    );
    const pricingRows = await listLockedProductEntitlementsForPurchase(
      userId,
      offer.product_id,
      client,
    );
    if (
      pricingRows.length === 0 ||
      lockedStats.length !== pricingRows.length ||
      pricingRows.some((item) => !item.available || item.is_default)
    ) {
      throw new EconomyServiceError(
        "ECONOMY_CATALOG_INVALID",
        "A composição de entitlements da oferta está inconsistente.",
        503,
      );
    }

    const quote = quoteEntitlements(
      pricingRows,
      offer.bundle_discount_bps,
      promotionDiscountBps,
    );
    const missingRows = pricingRows.filter((item) => !item.owned);
    if (quote.fullyOwned || missingRows.length === 0) {
      throw new EconomyServiceError(
        "ECONOMY_OFFER_ALREADY_OWNED",
        "Todos os itens desta oferta já pertencem ao comandante.",
        409,
      );
    }

    const missingBackgroundIds = new Set(
      missingRows
        .filter((item) => item.entitlement_kind === "profile_background")
        .map((item) => item.background_id)
        .filter((backgroundId): backgroundId is string => Boolean(backgroundId)),
    );
    if (missingBackgroundIds.size > 0) {
      const requirements = await listBackgroundCollectionRequirementsForPurchase(
        userId,
        offer.product_id,
        client,
      );

      for (const requirement of requirements) {
        if (!missingBackgroundIds.has(requirement.background_id)) continue;

        if (requirement.total_count <= 0) {
          throw new EconomyServiceError(
            "ECONOMY_CATALOG_INVALID",
            "A coleção exigida pelo fundo não possui itens válidos.",
            503,
          );
        }

        if (requirement.owned_count !== requirement.total_count) {
          throw new EconomyServiceError(
            "ECONOMY_COLLECTION_INCOMPLETE",
            `Complete a coleção ${requirement.collection_name} antes de adquirir este fundo (${requirement.owned_count}/${requirement.total_count}).`,
            409,
            {
              collectionId: requirement.collection_id,
              collectionName: requirement.collection_name,
              ownedCount: requirement.owned_count,
              totalCount: requirement.total_count,
            },
          );
        }
      }
    }

    const price = quote.finalPrice;
    if (price !== expectedPrice) {
      throw new EconomyServiceError(
        "ECONOMY_PRICE_CHANGED",
        "O preço da oferta mudou. Confirme o novo valor antes de comprar.",
        409,
        { currentPrice: price },
      );
    }
    if (wallet.balance < price) {
      throw new EconomyServiceError(
        "ECONOMY_INSUFFICIENT_BALANCE",
        "Saldo insuficiente para concluir esta compra.",
        409,
      );
    }

    const purchaseId = randomUUID();
    await createPurchaseReceipt(
      purchaseId,
      userId,
      offer.offer_id,
      price,
      pricingRows.length,
      idempotencyKey,
      client,
    );
    await snapshotPurchaseCommercialContext(
      purchaseId,
      offer.product_id,
      quote.subtotal,
      offer.bundle_discount_bps,
      promotionDiscountBps,
      client,
    );

    let updatedBalance = lockedWallet!.balance;
    if (price > 0) {
      const debitedBalance = await debitCampaignCreditWallet(userId, price, client);
      if (debitedBalance === null) {
        throw new EconomyServiceError(
          "ECONOMY_WALLET_CONFLICT",
          "A carteira mudou durante a compra. Nenhuma alteração foi confirmada.",
          409,
        );
      }
      updatedBalance = debitedBalance;
      await insertPurchaseLedgerEntry(userId, purchaseId, price, client);
    }

    for (const entitlement of missingRows) {
      const granted = await grantEntitlementOwnership(
        userId,
        entitlement,
        client,
      );
      if (!granted) {
        throw new EconomyServiceError(
          "ECONOMY_INVENTORY_CONFLICT",
          "A propriedade dos itens mudou durante a compra. Nenhuma alteração foi confirmada.",
          409,
        );
      }

      const unitPrice = entitlementUnitPrice(entitlement);
      await insertPurchaseEntitlement(
        purchaseId,
        entitlement,
        unitPrice,
        client,
      );
      await insertLegacyCosmeticPurchaseItem(
        purchaseId,
        entitlement,
        unitPrice,
        client,
      );

      if (!(await incrementEntitlementAcquisitionCount(entitlement, client))) {
        throw new EconomyServiceError(
          "ECONOMY_CATALOG_INVALID",
          "O contador de aquisição do entitlement está inconsistente.",
          503,
        );
      }
    }

    const [acquiredRows, entitlementRows] = await Promise.all([
      listPurchaseGrantedItems(userId, purchaseId, client),
      listPurchasedEntitlements(userId, purchaseId, client),
    ]);
    const result = {
      purchaseId,
      wallet: walletFromRow({ ...lockedWallet!, balance: updatedBalance }),
      acquiredItems: acquiredRows.map(cosmeticFromRow),
      acquiredEntitlements: entitlementRows.map((row) => ({
        kind: row.entitlement_kind,
        id: row.entitlement_id,
        unitPrice: Number(row.unit_price),
      })),
      offer: {
        id: offer.offer_id,
        ownedCount: pricingRows.length,
        totalCount: pricingRows.length,
        fullyOwned: true,
      },
    } satisfies PurchaseOfferResult;

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function equipCosmetic(
  userId: string,
  slot: CosmeticSlot,
  cosmeticId: string,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureLockedEconomyState(userId, client);

    const item = await findOwnedCosmetic(userId, cosmeticId, client);
    if (!item) {
      throw new EconomyServiceError(
        "ECONOMY_COSMETIC_NOT_OWNED",
        "O comandante não possui esse cosmético.",
        403,
      );
    }

    if (item.slot !== slot) {
      throw new EconomyServiceError(
        "ECONOMY_SLOT_MISMATCH",
        "O cosmético não é compatível com esse slot.",
        400,
      );
    }

    if (item.status !== "available" && item.status !== "retired") {
      throw new EconomyServiceError(
        "ECONOMY_COSMETIC_NOT_EQUIPPABLE",
        "Esse cosmético não está disponível para equipagem.",
        409,
      );
    }

    await equipOwnedCosmetic(userId, slot, cosmeticId, client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
