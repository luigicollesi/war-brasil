import type {
  CampaignCreditWallet,
  CosmeticCatalogItem,
  EconomyOffer,
  EconomyStorefrontSnapshot,
  StorefrontCollection,
} from "./economy-contract";

export type StoreShowcaseKind = "offer" | "collection";
export type StoreShowcaseMode = "standard" | "collection";
export type StoreShowcaseItemType = "dice" | "territory";

export type StoreShowcaseOffer = Readonly<{
  id: string;
  name: string;
  basePrice: number;
  promotionDiscountBps: number;
  price: number;
  startsAt: string | null;
  endsAt: string | null;
  ownedCount: number;
  totalCount: number;
  fullyOwned: boolean;
  partiallyOwned: boolean;
  purchasable: boolean;
}>;

export type StoreShowcaseItem = Readonly<{
  id: string;
  name: string;
  description: string | null;
  slot: CosmeticCatalogItem["slot"];
  type: StoreShowcaseItemType;
  owned: boolean;
  equipped: boolean;
  previewRef: string | null;
  assetRef: string | null;
  effectKey: string | null;
  singleOffer: StoreShowcaseOffer | null;
}>;

export type StoreShowcaseView = Readonly<{
  kind: StoreShowcaseKind;
  id: string;
  mode: StoreShowcaseMode;
  title: string;
  description: string | null;
  wallet: CampaignCreditWallet;
  backgroundRef: string | null;
  logoRef: string | null;
  featured: boolean;
  promotionDiscountBps: number;
  items: ReadonlyArray<StoreShowcaseItem>;
  selectedItemId: string;
  bundleOffer: StoreShowcaseOffer | null;
  singleOfferByItemId: Readonly<Record<string, StoreShowcaseOffer>>;
  ownedCount: number;
  totalCount: number;
  fullyOwned: boolean;
  partiallyOwned: boolean;
}>;

function projectOffer(offer: EconomyOffer): StoreShowcaseOffer {
  return {
    id: offer.id,
    name: offer.name,
    basePrice: offer.basePrice,
    promotionDiscountBps: offer.promotionDiscountBps,
    price: offer.price,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    ownedCount: offer.ownedCount,
    totalCount: offer.totalCount,
    fullyOwned: offer.fullyOwned,
    partiallyOwned: offer.partiallyOwned,
    purchasable: offer.purchasable,
  };
}

function itemType(item: CosmeticCatalogItem): StoreShowcaseItemType {
  return item.slot === "territory_skin" ? "territory" : "dice";
}

function singleOffersForItems(
  storefront: EconomyStorefrontSnapshot,
  items: ReadonlyArray<CosmeticCatalogItem>,
  allowedOfferIds?: ReadonlySet<string>,
) {
  const itemIds = new Set(items.map((item) => item.id));
  const result: Record<string, StoreShowcaseOffer> = {};

  for (const offer of storefront.offers) {
    if (allowedOfferIds && !allowedOfferIds.has(offer.id)) continue;
    if (offer.items.length !== 1) continue;
    const item = offer.items[0];
    if (!itemIds.has(item.id)) continue;
    result[item.id] = projectOffer(offer);
  }

  return result;
}

function projectItems(
  items: ReadonlyArray<CosmeticCatalogItem>,
  singleOfferByItemId: Readonly<Record<string, StoreShowcaseOffer>>,
) {
  return items.map((item): StoreShowcaseItem => ({
    id: item.id,
    name: item.name,
    description: item.description,
    slot: item.slot,
    type: itemType(item),
    owned: item.owned,
    equipped: item.equipped,
    previewRef: item.previewRef,
    assetRef: item.assetRef,
    effectKey: item.effectKey,
    singleOffer: singleOfferByItemId[item.id] ?? null,
  }));
}

function resolveSelectedItemId(
  items: ReadonlyArray<CosmeticCatalogItem>,
  selectedItemId?: string | null,
) {
  const selectedItem = selectedItemId
    ? items.find((item) => item.id === selectedItemId)
    : null;
  return (selectedItem ?? items[0])?.id ?? null;
}

function resolveOfferShowcase(
  storefront: EconomyStorefrontSnapshot,
  offer: EconomyOffer,
  selectedItemId?: string | null,
): StoreShowcaseView | null {
  const items = offer.items;
  const resolvedSelectedItemId = resolveSelectedItemId(items, selectedItemId);
  if (!resolvedSelectedItemId) return null;

  const singleOfferByItemId = singleOffersForItems(storefront, items);
  if (items.length === 1 && !singleOfferByItemId[items[0].id]) {
    singleOfferByItemId[items[0].id] = projectOffer(offer);
  }

  const bundleOffer = items.length > 1 ? projectOffer(offer) : null;

  return {
    kind: "offer",
    id: offer.id,
    mode: "standard",
    title: offer.name,
    description: offer.description,
    wallet: storefront.wallet,
    backgroundRef: null,
    logoRef: null,
    featured: offer.featured,
    promotionDiscountBps: offer.promotionDiscountBps,
    items: projectItems(items, singleOfferByItemId),
    selectedItemId: resolvedSelectedItemId,
    bundleOffer,
    singleOfferByItemId,
    ownedCount: offer.ownedCount,
    totalCount: offer.totalCount,
    fullyOwned: offer.fullyOwned,
    partiallyOwned: offer.partiallyOwned,
  };
}

function resolveCollectionShowcase(
  storefront: EconomyStorefrontSnapshot,
  collection: StorefrontCollection,
  selectedItemId?: string | null,
): StoreShowcaseView | null {
  const items = collection.items;
  const resolvedSelectedItemId = resolveSelectedItemId(items, selectedItemId);
  if (!resolvedSelectedItemId) return null;

  const singleOfferIds = new Set(collection.singleOfferIds);
  const singleOfferByItemId = singleOffersForItems(storefront, items, singleOfferIds);
  const bundleOffer = collection.bundleOfferIds
    .map((offerId) => storefront.offers.find((offer) => offer.id === offerId) ?? null)
    .find((offer): offer is EconomyOffer => offer !== null) ?? null;

  return {
    kind: "collection",
    id: collection.id,
    mode: "collection",
    title: collection.name,
    description: collection.description,
    wallet: storefront.wallet,
    backgroundRef: collection.assets.background,
    logoRef: collection.assets.logo,
    featured: collection.featured,
    promotionDiscountBps: collection.promotionDiscountBps,
    items: projectItems(items, singleOfferByItemId),
    selectedItemId: resolvedSelectedItemId,
    bundleOffer: bundleOffer ? projectOffer(bundleOffer) : null,
    singleOfferByItemId,
    ownedCount: collection.ownedCount,
    totalCount: collection.totalCount,
    fullyOwned: collection.fullyOwned,
    partiallyOwned: collection.partiallyOwned,
  };
}

export function resolveStoreShowcaseView(
  storefront: EconomyStorefrontSnapshot,
  kind: StoreShowcaseKind,
  id: string,
  selectedItemId?: string | null,
): StoreShowcaseView | null {
  if (kind === "offer") {
    const offer = storefront.offers.find((candidate) => candidate.id === id);
    return offer ? resolveOfferShowcase(storefront, offer, selectedItemId) : null;
  }

  if (kind === "collection") {
    const collection = storefront.collections.find((candidate) => candidate.id === id);
    return collection
      ? resolveCollectionShowcase(storefront, collection, selectedItemId)
      : null;
  }

  return null;
}
