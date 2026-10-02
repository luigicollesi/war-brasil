export type DiceBodySlot =
  | "dice_attack"
  | "dice_defense"
  | "dice_neutral";

export const LIGHT_DICE_BODY_COLOR = Object.freeze({
  dice_attack: "#BF4D4D",
  dice_defense: "#3984C6",
  dice_neutral: "#3F8B68",
} satisfies Readonly<Record<DiceBodySlot, string>>);

const DARK_BODY_CHANNEL_RATIO = 0.58;

function darkenHexColor(hex: string, ratio: number) {
  const packed = Number.parseInt(hex.slice(1), 16);
  const channels = [
    (packed >> 16) & 0xff,
    (packed >> 8) & 0xff,
    packed & 0xff,
  ];

  return `#${channels
    .map((channel) =>
      Math.round(channel * ratio)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase(),
    )
    .join("")}`;
}

export const DARK_DICE_BODY_COLOR = Object.freeze(
  Object.fromEntries(
    Object.entries(LIGHT_DICE_BODY_COLOR).map(([slot, color]) => [
      slot,
      darkenHexColor(color, DARK_BODY_CHANNEL_RATIO),
    ]),
  ),
) as Readonly<Record<DiceBodySlot, string>>;

export function isDiceBodySlot(slot: string): slot is DiceBodySlot {
  return (
    slot === "dice_attack" ||
    slot === "dice_defense" ||
    slot === "dice_neutral"
  );
}

export function diceBodyColorForSlot(slot: string, dark: boolean) {
  if (!isDiceBodySlot(slot)) return null;
  return dark ? DARK_DICE_BODY_COLOR[slot] : LIGHT_DICE_BODY_COLOR[slot];
}
