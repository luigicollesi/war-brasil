export type ProfileAppearanceRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export type CommanderTitleAppearance = Readonly<{
  id: string;
  name: string;
  displayText: string;
  description: string | null;
  rarity: ProfileAppearanceRarity;
  fontKey: string;
  styleKey: string;
  textureRef: string | null;
  isActive: boolean;
  equipped: boolean;
}>;

export type CommanderBackgroundAppearance = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rarity: ProfileAppearanceRarity;
  assetRef: string;
  previewRef: string | null;
  isDefault: boolean;
  isActive: boolean;
  equipped: boolean;
}>;

export type ProfileAppearanceSnapshot = Readonly<{
  equippedTitleId: string | null;
  equippedBackgroundId: string;
  titles: ReadonlyArray<CommanderTitleAppearance>;
  backgrounds: ReadonlyArray<CommanderBackgroundAppearance>;
}>;

export type ProfileAppearanceUpdate = Readonly<{
  titleId?: string | null;
  backgroundId?: string;
}>;

export type PublicCommanderTitleAppearance = Readonly<{
  id: string;
  displayText: string;
  rarity: ProfileAppearanceRarity;
  fontKey: string;
  styleKey: string;
  textureRef: string | null;
}>;

export type PublicCommanderBackgroundAppearance = Readonly<{
  id: string;
  name: string;
  rarity: ProfileAppearanceRarity;
  assetRef: string;
}>;
