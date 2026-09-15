export const ECONOMY_CURRENCY_ID = "campaign-credit" as const;

export const COSMETIC_SLOTS = [
  "dice_attack",
  "dice_defense",
  "dice_neutral",
  "territory_skin",
] as const;

export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];
export type CosmeticCatalogStatus = "draft" | "announced" | "available" | "retired";
export type EconomyOfferStatus = "draft" | "available" | "retired";
export type EconomyCreditPackStatus = "draft" | "announced" | "retired";
export type CosmeticAcquisitionSource =
  | "default"
  | "purchase"
  | "reward"
  | "promotion"
  | "admin";

export type CampaignCreditWallet = Readonly<{
  currency: typeof ECONOMY_CURRENCY_ID;
  label: "Créditos de Campanha";
  shortLabel: "CRÉDITOS";
  symbol: "◈";
  balance: number;
}>;

export type CosmeticCatalogItem = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string | null;
  slot: CosmeticSlot;
  rarity: string | null;
  status: CosmeticCatalogStatus;
  isDefault: boolean;
  owned: boolean;
  equipped: boolean;
  previewRef: string | null;
  assetRef: string | null;
  effectKey: string | null;
}>;

export type CosmeticSet = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: CosmeticCatalogStatus;
  previewRef: string | null;
  items: ReadonlyArray<CosmeticCatalogItem>;
}>;

export type EconomyOffer = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string | null;
  currency: typeof ECONOMY_CURRENCY_ID;
  price: number;
  status: EconomyOfferStatus;
  featured: boolean;
  items: ReadonlyArray<CosmeticCatalogItem>;
  ownedCount: number;
  totalCount: number;
  fullyOwned: boolean;
  partiallyOwned: boolean;
  purchasable: boolean;
}>;

export type EconomyCreditPack = Readonly<{
  id: string;
  slug: string;
  name: string;
  creditAmount: number;
  priceBrlCents: number;
  status: EconomyCreditPackStatus;
}>;

export type CosmeticLoadout = Readonly<Record<CosmeticSlot, CosmeticCatalogItem>>;

export type EconomyStorefrontSnapshot = Readonly<{
  wallet: CampaignCreditWallet;
  loadout: CosmeticLoadout;
  ownedItems: ReadonlyArray<CosmeticCatalogItem>;
  sets: ReadonlyArray<CosmeticSet>;
  offers: ReadonlyArray<EconomyOffer>;
  creditPacks: ReadonlyArray<EconomyCreditPack>;
}>;

export type EquipCosmeticInput = Readonly<{
  slot: CosmeticSlot;
  cosmeticId: string;
}>;

export type PurchaseOfferInput = Readonly<{
  offerId: string;
  idempotencyKey: string;
  expectedPrice: number;
}>;

export type PurchaseOfferResult = Readonly<{
  purchaseId: string;
  wallet: CampaignCreditWallet;
  acquiredItems: ReadonlyArray<CosmeticCatalogItem>;
  offer: Readonly<{
    id: string;
    ownedCount: number;
    totalCount: number;
    fullyOwned: boolean;
  }>;
}>;

export function isCosmeticSlot(value: unknown): value is CosmeticSlot {
  return typeof value === "string" && (COSMETIC_SLOTS as readonly string[]).includes(value);
}
