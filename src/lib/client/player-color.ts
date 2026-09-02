import { PLAYER_COLORS, type PlayerColor } from "../shared/lobby";

export const PLAYER_COLOR_HEX = Object.freeze(
  Object.fromEntries(PLAYER_COLORS.map((color) => [color.value, color.hex])),
) as Readonly<Record<PlayerColor, string>>;

export function playerColorHex(color: PlayerColor) {
  return PLAYER_COLOR_HEX[color];
}
