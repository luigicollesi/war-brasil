import type { PlayerColor } from "@/src/lib/lobby";

export type TerritoryMaterial = {
  playerColor: PlayerColor | null;
  face: readonly [string, string, string, string, string];
  side: readonly [string, string, string];
  rim: string;
};

export type TerritorySurfacePalette = {
  highlight: string;
  hover: string;
  highlightedHover: string;
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

// Interaction colors are static by design. Highlight keeps the metallic top
// tone from the previous treatment, while both hover variants are deliberately
// more vibrant so pointer feedback stays obvious without filters or overlays.
const TERRITORY_SURFACE_PALETTES: Record<PlayerColor, TerritorySurfacePalette> = {
  forest: {
    highlight: "#86d2a5",
    hover: "#62c88b",
    highlightedHover: "#a4e6bd",
    edge: "#8fdaad",
    edgeStrong: "#c3efd1",
  },
  ocean: {
    highlight: "#82bfe8",
    hover: "#55aeee",
    highlightedHover: "#a2d5f4",
    edge: "#8bc8ed",
    edgeStrong: "#c3e4f6",
  },
  sun: {
    highlight: "#e7c552",
    hover: "#f0c62e",
    highlightedHover: "#f3dd76",
    edge: "#edcf64",
    edgeStrong: "#f6e59e",
  },
  ruby: {
    highlight: "#e6817f",
    hover: "#ee625f",
    highlightedHover: "#f1a09b",
    edge: "#ea8d89",
    edgeStrong: "#f4b6af",
  },
  violet: {
    highlight: "#b68bd8",
    hover: "#ad67df",
    highlightedHover: "#cda7e7",
    edge: "#bf98df",
    edgeStrong: "#dcc5ed",
  },
  orange: {
    highlight: "#e99453",
    hover: "#f18336",
    highlightedHover: "#f2af72",
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

export function territorySurfacePalette(
  color: PlayerColor,
): TerritorySurfacePalette {
  return TERRITORY_SURFACE_PALETTES[color];
}

export function neutralTerritoryMaterial(): TerritoryMaterial {
  return NEUTRAL_TERRITORY_MATERIAL;
}
