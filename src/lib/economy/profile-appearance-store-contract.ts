import type { ProfileAppearanceRarity } from "@/src/lib/profile/profile-appearance-contract";

export type ProfileAppearanceStoreTitle = Readonly<{
  kind: "commander_title";
  id: string;
  name: string;
  displayText: string;
  description: string | null;
  rarity: ProfileAppearanceRarity;
  collectionId: string | null;
  fontKey: string;
  styleKey: string;
  textureRef: string | null;
  owned: boolean;
}>;

export type ProfileAppearanceStoreBackground = Readonly<{
  kind: "profile_background";
  id: string;
  name: string;
  description: string | null;
  rarity: ProfileAppearanceRarity;
  collectionId: string | null;
  assetRef: string;
  previewRef: string | null;
  owned: boolean;
}>;

export type ProfileAppearanceStoreItem =
  | ProfileAppearanceStoreTitle
  | ProfileAppearanceStoreBackground;

export type ProfileAppearanceStoreOffer = Readonly<{
  id: string;
  productId: string;
  name: string;
  description: string | null;
  basePrice: number;
  promotionDiscountBps: number;
  price: number;
  ownedCount: number;
  totalCount: number;
  fullyOwned: boolean;
  partiallyOwned: boolean;
  purchasable: boolean;
  items: ReadonlyArray<ProfileAppearanceStoreItem>;
}>;

export type ProfileAppearanceStorefront = Readonly<{
  offers: ReadonlyArray<ProfileAppearanceStoreOffer>;
}>;
