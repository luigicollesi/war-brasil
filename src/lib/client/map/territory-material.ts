import type { PlayerColor } from "@/src/lib/lobby";

export type TerritoryMaterial = {
  playerColor: PlayerColor | null;
  face: readonly [string, string, string, string, string];
  side: readonly [string, string, string];
  rim: string;
};

export type TerritoryHighlightPalette = {
  soft: string;
  peak: string;
  edge: string;
  edgeStrong: string;
};

const TERRITORY_MATERIALS: Record<PlayerColor, TerritoryMaterial> = {
  forest: {
    playerColor: "forest",
    face: ["#58aa83", "#50a07a", "#499571", "#468b6a", "#438264"],
    side: ["#3b6b54", "#355f4b", "#305242"],
    rim: "#284135",
  },
  ocean: {
    playerColor: "ocean",
    face: ["#5e9cd3", "#4f94d1", "#408bce", "#3785ca", "#347ec0"],
    side: ["#316ea5", "#2e6596", "#2c5c87"],
    rim: "#274e72",
  },
  sun: {
    playerColor: "sun",
    face: ["#dcad28", "#d1a421", "#c3981d", "#b78f1c", "#ab861c"],
    side: ["#8e701a", "#7e6418", "#6e5716"],
    rim: "#584613",
  },
  ruby: {
    playerColor: "ruby",
    face: ["#d07372", "#cc6464", "#c95655", "#c54e4d", "#c04544"],
    side: ["#a93e3d", "#9b3a39", "#8c3737"],
    rim: "#783231",
  },
  violet: {
    playerColor: "violet",
    face: ["#a683c9", "#9d76c4", "#9468c0", "#8e60bb", "#8758b6"],
    side: ["#784da3", "#6f4896", "#664488"],
    rim: "#593e75",
  },
  orange: {
    playerColor: "orange",
    face: ["#d7854c", "#d57b3c", "#d3712c", "#c76c2b", "#bc662a"],
    side: ["#a05927", "#905125", "#814923"],
    rim: "#6b3e1f",
  },
};

// Curved state-layer colors stay chromatic instead of passing through white.
// Values are intentionally static so interaction never performs color math.
const TERRITORY_HIGHLIGHT_PALETTES: Record<
  PlayerColor,
  TerritoryHighlightPalette
> = {
  forest: {
    soft: "#86d2a5",
    peak: "#b9e9ca",
    edge: "#8fdaad",
    edgeStrong: "#c3efd1",
  },
  ocean: {
    soft: "#82bfe8",
    peak: "#b8dcf3",
    edge: "#8bc8ed",
    edgeStrong: "#c3e4f6",
  },
  sun: {
    soft: "#e7c552",
    peak: "#f3df8b",
    edge: "#edcf64",
    edgeStrong: "#f6e59e",
  },
  ruby: {
    soft: "#e6817f",
    peak: "#f1aaa4",
    edge: "#ea8d89",
    edgeStrong: "#f4b6af",
  },
  violet: {
    soft: "#b68bd8",
    peak: "#d4b7e9",
    edge: "#bf98df",
    edgeStrong: "#dcc5ed",
  },
  orange: {
    soft: "#e99453",
    peak: "#f2ba84",
    edge: "#eda061",
    edgeStrong: "#f5c393",
  },
};

const NEUTRAL_TERRITORY_MATERIAL: TerritoryMaterial = {
  playerColor: null,
  face: ["#939c98", "#8b9490", "#828b87", "#79827e", "#717a76"],
  side: ["#626b67", "#58605d", "#4d5552"],
  rim: "#3f4744",
};

export function territoryMaterial(color: PlayerColor): TerritoryMaterial {
  return TERRITORY_MATERIALS[color];
}

export function territoryHighlightPalette(
  color: PlayerColor,
): TerritoryHighlightPalette {
  return TERRITORY_HIGHLIGHT_PALETTES[color];
}

export function neutralTerritoryMaterial(): TerritoryMaterial {
  return NEUTRAL_TERRITORY_MATERIAL;
}
