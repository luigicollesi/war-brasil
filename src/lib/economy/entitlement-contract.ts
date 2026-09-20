export const ENTITLEMENT_KINDS = [
  "game_cosmetic",
  "commander_title",
  "profile_background",
] as const;

export type EntitlementKind = (typeof ENTITLEMENT_KINDS)[number];

export type EconomyEntitlementRef = Readonly<{
  kind: EntitlementKind;
  id: string;
}>;

export type PurchasedEntitlement = Readonly<{
  kind: EntitlementKind;
  id: string;
  unitPrice: number;
}>;
