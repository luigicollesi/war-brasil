import type { PlayerColor } from "../shared/lobby";

export const PLAYER_COLOR_HEX: Readonly<Record<PlayerColor, string>> = {
  forest: "#448c3f",
  ruby: "#ba3535",
  amber: "#d89731",
  indigo: "#3456b2",
  violet: "#8a49a8",
  cyan: "#168f9c",
};

export function playerColorHex(color: PlayerColor) {
  return PLAYER_COLOR_HEX[color];
}
