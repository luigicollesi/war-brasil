export type ProfileDisplaySlot =
  | "attack"
  | "defense"
  | "neutral"
  | "territory";

export type ProfileDisplaySlotLayout = Readonly<{
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  scale: number;
}>;

export type ProfileDisplayLayout = Readonly<
  Record<ProfileDisplaySlot, ProfileDisplaySlotLayout>
>;

export const PROFILE_DISPLAY_LAYOUTS: Readonly<{
  desktop: ProfileDisplayLayout;
  compact: ProfileDisplayLayout;
  compactShort: ProfileDisplayLayout;
}> = {
  desktop: {
    attack: { x: 0.14, y: 0.615, labelX: 0.14, labelY: 0.715, scale: 1.58 },
    defense: { x: 0.38, y: 0.615, labelX: 0.38, labelY: 0.715, scale: 1.58 },
    neutral: { x: 0.62, y: 0.615, labelX: 0.62, labelY: 0.715, scale: 1.58 },
    territory: { x: 0.86, y: 0.615, labelX: 0.86, labelY: 0.715, scale: 1.18 },
  },
  compact: {
    attack: { x: 0.27, y: 0.445, labelX: 0.27, labelY: 0.505, scale: 1.2 },
    defense: { x: 0.73, y: 0.445, labelX: 0.73, labelY: 0.505, scale: 1.2 },
    neutral: { x: 0.27, y: 0.705, labelX: 0.27, labelY: 0.765, scale: 1.2 },
    territory: { x: 0.73, y: 0.705, labelX: 0.73, labelY: 0.765, scale: 0.95 },
  },
  compactShort: {
    attack: { x: 0.27, y: 0.43, labelX: 0.27, labelY: 0.49, scale: 1.14 },
    defense: { x: 0.73, y: 0.43, labelX: 0.73, labelY: 0.49, scale: 1.14 },
    neutral: { x: 0.27, y: 0.68, labelX: 0.27, labelY: 0.74, scale: 1.14 },
    territory: { x: 0.73, y: 0.68, labelX: 0.73, labelY: 0.74, scale: 0.9 },
  },
};
