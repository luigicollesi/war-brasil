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
import { territorySkinAssetDeliveryPath } from "../../economy/territory-skin-contract";
import { diceAssetDeliveryPath } from "../assets/asset-storage-service";
import { pool } from "../db/pool";
import {
  createPurchaseReceipt,
  debitCampaignCreditWallet,
  equipOwnedCosmetic,
  findCampaignCreditWallet,
  findOwnedCosmetic,
  findPurchaseReceiptByIdempotencyKey,
  grantPurchasedCosmetics,
  initializeEconomyState,
  insertPurchaseLedgerEntry,
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
  listStorefrontCreditPacks,
  listStorefrontOfferItems,
  listStorefrontOffers,
  type CreditPackRow,
  type StorefrontOfferItemRow,
  type StorefrontOfferRow,
} from "./economy-storefront-repository";
import {
  incrementCosmeticAcquisitionCounts,
  listActiveStorefrontOfferProducts,
  listActiveStorefrontQuoteItems,
  listLockedProductQuoteItems,
  lockOfferProductForPurchase,
  lockProductCosmeticStats,
  snapshotPurchaseCommercialContext,
  snapshotPurchaseItemPrices,
  type StorefrontOfferProductRow,
  type StorefrontQuoteItemRow,
} from "./storefront-quote-repository";

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

function projectedAssetRef(row: CosmeticRow) {
  if (!row.asset_ref) return null;
  if (row.slot === "territory_skin") {
    return territorySkinAssetDeliveryPath(row.asset_ref);
  }
  if (row.asset_ref.startsWith("cosmetics/dice/")) {
    return diceAssetDeliveryPath(row.asset_ref);
  }
  return row.asset_ref;
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
    previewRef: row.preview_ref,
    assetRef: projectedAssetRef(row),
    effectKey: row.effect_key,
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

function integerAmount(
  value: string,
  errorCode: string,
  minimum: number,
) {
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
) {
  try {
    return quoteStorefrontProduct(rows.map(quoteItemFromRow), discountBps);
  } catch (error) {
    if (error instanceof EconomyServiceError) throw error;
    throw new EconomyServiceError(
      "ECONOMY_CATALOG_INVALID",
      "A configuração de preço da loja é inválida.",
      503,
    );
  }
}

function unitPriceFromRow(row: StorefrontQuoteItemRow) {
  try {
    return resolveStorefrontUnitPrice(quoteItemFromRow(row).pricing);
  } catch (error) {
    if (error instanceof EconomyServiceError) throw error;
    throw new EconomyServiceError(
      "ECONOMY_CATALOG_INVALID",
      "A configuração de preço da loja é inválida.",
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

    const quote = quoteFromRows(pricingItems, product.bundle_discount_bps);
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
      price: quote.finalPrice,
      status: row.status,
      featured: row.is_featured,
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

async function ensureLockedEconomyState(
  userId: string,
  db: EconomyQueryable,
) {
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

export async function ensureEconomyState(
  userId: string,
  db?: EconomyQueryable,
) {
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

export async function getEconomyStorefront(
  userId: string,
): Promise<EconomyStorefrontSnapshot> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureLockedEconomyState(userId, client);

    // A single pg Client owns one PostgreSQL connection. Keep these reads
    // sequential so transaction ordering remains explicit and compatible with
    // node-postgres v9, which no longer accepts concurrent queries per client.
    const walletRow = await findCampaignCreditWallet(userId, client);
    const ownedRows = await listOwnedCosmetics(userId, client);
    const setRows = await listStorefrontSetItems(userId, client);
    const offerRows = await listStorefrontOffers(client);
    const offerItemRows = await listStorefrontOfferItems(userId, client);
    const productRows = await listActiveStorefrontOfferProducts(client);
    const quoteRows = await listActiveStorefrontQuoteItems(userId, client);
    const creditPackRows = await listStorefrontCreditPacks(client);

    const snapshot = {
      wallet: walletFromRow(walletRow),
      loadout: loadoutFromOwned(ownedRows),
      ownedItems: ownedRows.map(cosmeticFromRow),
      sets: setsFromRows(setRows),
      offers: offersFromRows(offerRows, offerItemRows, productRows, quoteRows),
      creditPacks: creditPacksFromRows(creditPackRows),
    } satisfies EconomyStorefrontSnapshot;

    await client.query("COMMIT");
    return snapshot;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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

      const acquiredRows = await listPurchaseGrantedItems(userId, existing.id, client);
      const result = {
        purchaseId: existing.id,
        wallet,
        acquiredItems: acquiredRows.map(cosmeticFromRow),
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

    const lockedStats = await lockProductCosmeticStats(offer.product_id, client);
    const pricingRows = await listLockedProductQuoteItems(
      userId,
      offer.id,
      offer.product_id,
      client,
    );
    if (
      pricingRows.length === 0 ||
      lockedStats.length !== pricingRows.length ||
      pricingRows.some((item) => item.status !== "available" || item.is_default)
    ) {
      throw new EconomyServiceError(
        "ECONOMY_CATALOG_INVALID",
        "A composição da oferta está inconsistente.",
        503,
      );
    }

    const quote = quoteFromRows(pricingRows, offer.bundle_discount_bps);
    const missingRows = pricingRows.filter((item) => !item.owned);
    if (quote.fullyOwned || missingRows.length === 0) {
      throw new EconomyServiceError(
        "ECONOMY_OFFER_ALREADY_OWNED",
        "Todos os cosméticos desta oferta já pertencem ao comandante.",
        409,
      );
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
      offer.id,
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

    const grantItems = missingRows.map((item) => ({
      id: item.cosmetic_id,
      slot: item.slot,
    }));
    const grantedIds = await grantPurchasedCosmetics(
      userId,
      purchaseId,
      grantItems,
      client,
    );
    if (grantedIds.length !== missingRows.length) {
      throw new EconomyServiceError(
        "ECONOMY_INVENTORY_CONFLICT",
        "O inventário mudou durante a compra. Nenhuma alteração foi confirmada.",
        409,
      );
    }

    const advancedCounters = await incrementCosmeticAcquisitionCounts(
      grantedIds,
      client,
    );
    if (advancedCounters.length !== grantedIds.length) {
      throw new EconomyServiceError(
        "ECONOMY_CATALOG_INVALID",
        "Os contadores de aquisição da oferta estão inconsistentes.",
        503,
      );
    }

    const grantedIdSet = new Set(grantedIds);
    await snapshotPurchaseItemPrices(
      purchaseId,
      missingRows
        .filter((item) => grantedIdSet.has(item.cosmetic_id))
        .map((item) => ({
          cosmeticId: item.cosmetic_id,
          unitPrice: unitPriceFromRow(item),
        })),
      client,
    );

    const acquiredRows = await listPurchaseGrantedItems(userId, purchaseId, client);
    const result = {
      purchaseId,
      wallet: walletFromRow({ ...lockedWallet!, balance: updatedBalance }),
      acquiredItems: acquiredRows.map(cosmeticFromRow),
      offer: {
        id: offer.id,
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
