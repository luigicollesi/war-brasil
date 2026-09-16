import type {
  CampaignCreditWallet,
  CosmeticCatalogItem,
  EconomyOffer,
  EconomyStorefrontSnapshot,
  StorefrontCollection,
} from "./economy-contract";

export type StoreShowcaseTargetKind = "offer" | "collection";

export type StoreShowcaseItem = Readonly<{
  cosmetic: CosmeticCatalogItem;
  individualOffer: EconomyOffer | null;
}>;

export type StoreShowcaseViewModel = Readonly<{
  kind: StoreShowcaseTargetKind;
  id: string;
  mode: "standard" | "collection";
  title: string;
  description: string | null;
  wallet: CampaignCreditWallet;
  background: string | null;
  logo: string | null;
  promotionDiscountBps: number;
  items: ReadonlyArray<StoreShowcaseItem>;
  selectedItemId: string;
  bundleOffer: EconomyOffer | null;
  ownedCount: number;
  totalCount: number;
  fullyOwned: boolean;
  partiallyOwned: boolean;
}>;

function offerById(storefront: EconomyStorefrontSnapshot, id: string) {
  return storefront.offers.find((offer) => offer.id === id) ?? null;
}

function singleOfferForCosmetic(
  storefront: EconomyStorefrontSnapshot,
  cosmeticId: string,
) {
  return (
    storefront.offers.find(
      (offer) =>
        offer.items.length === 1 && offer.items[0]?.id === cosmeticId,
    ) ?? null
  );
}

function selectedItemId(
  items: ReadonlyArray<CosmeticCatalogItem>,
  requestedItemId?: string | null,
) {
  if (
    requestedItemId &&
    items.some((item) => item.id === requestedItemId)
  ) {
    return requestedItemId;
  }
  return items[0]?.id ?? "";
}

function collectionSingles(
  storefront: EconomyStorefrontSnapshot,
  collection: StorefrontCollection,
) {
  const byCosmeticId = new Map<string, EconomyOffer>();
  for (const offerId of collection.singleOfferIds) {
    const offer = offerById(storefront, offerId);
    if (!offer || offer.items.length !== 1) continue;
    const cosmetic = offer.items[0];
    if (cosmetic) byCosmeticId.set(cosmetic.id, offer);
  }
  return byCosmeticId;
}

function projectOffer(
  storefront: EconomyStorefrontSnapshot,
  offer: EconomyOffer,
  requestedItemId?: string | null,
): StoreShowcaseViewModel | null {
  if (offer.items.length === 0) return null;

  const items = offer.items.map((cosmetic) => ({
    cosmetic,
    individualOffer:
      offer.items.length === 1
        ? offer
        : singleOfferForCosmetic(storefront, cosmetic.id),
  }));

  return {
    kind: "offer",
    id: offer.id,
    mode: "standard",
    title: offer.name,
    description: offer.description,
    wallet: storefront.wallet,
    background: null,
    logo: null,
    promotionDiscountBps: offer.promotionDiscountBps,
    items,
    selectedItemId: selectedItemId(offer.items, requestedItemId),
    bundleOffer: offer.items.length > 1 ? offer : null,
    ownedCount: offer.ownedCount,
    totalCount: offer.totalCount,
    fullyOwned: offer.fullyOwned,
    partiallyOwned: offer.partiallyOwned,
  };
}

function projectCollection(
  storefront: EconomyStorefrontSnapshot,
  collection: StorefrontCollection,
  requestedItemId?: string | null,
): StoreShowcaseViewModel | null {
  if (collection.items.length === 0) return null;

  const singles = collectionSingles(storefront, collection);
  const bundleOffer =
    collection.bundleOfferIds
      .map((offerId) => offerById(storefront, offerId))
      .find((offer): offer is EconomyOffer => offer !== null) ?? null;

  return {
    kind: "collection",
    id: collection.id,
    mode: "collection",
    title: collection.name,
    description: collection.description,
    wallet: storefront.wallet,
    background: collection.assets.background,
    logo: collection.assets.logo,
    promotionDiscountBps: collection.promotionDiscountBps,
    items: collection.items.map((cosmetic) => ({
      cosmetic,
      individualOffer: singles.get(cosmetic.id) ?? null,
    })),
    selectedItemId: selectedItemId(collection.items, requestedItemId),
    bundleOffer,
    ownedCount: collection.ownedCount,
    totalCount: collection.totalCount,
    fullyOwned: collection.fullyOwned,
    partiallyOwned: collection.partiallyOwned,
  };
}

export function projectStoreShowcase(
  storefront: EconomyStorefrontSnapshot,
  kind: string,
  id: string,
  requestedItemId?: string | null,
): StoreShowcaseViewModel | null {
  if (kind === "offer") {
    const offer = offerById(storefront, id);
    return offer ? projectOffer(storefront, offer, requestedItemId) : null;
  }

  if (kind === "collection") {
    const collection =
      storefront.collections.find((candidate) => candidate.id === id) ?? null;
    return collection
      ? projectCollection(storefront, collection, requestedItemId)
      : null;
  }

  return null;
}
