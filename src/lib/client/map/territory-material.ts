import type { PlayerColor } from "@/src/lib/lobby";

export type TerritoryMaterial = {
  playerColor: PlayerColor | null;
  face: readonly [string, string, string, string, string];
  side: readonly [string, string, string];
  rim: string;
};

export type TerritorySelectionMaterial = {
  face: readonly [string, string, string, string, string];
  edgeLight: string;
  edgeDark: string;
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

const SELECTED_TERRITORY_MATERIALS: Record<
  PlayerColor,
  TerritorySelectionMaterial
> = {
  forest: {
    face: ["#c7f6da", "#6bc492", "#d8ffea", "#3e8f67", "#1f4a36"],
    edgeLight: "#d9ffe8",
    edgeDark: "#183b2c",
  },
  ocean: {
    face: ["#d3eeff", "#6bb7ea", "#dff4ff", "#347fc0", "#183f69"],
    edgeLight: "#e0f6ff",
    edgeDark: "#143a62",
  },
  sun: {
    face: ["#fff2a6", "#e4bc42", "#fff7c9", "#c28c1d", "#65490e"],
    edgeLight: "#fff6bf",
    edgeDark: "#61470c",
  },
  ruby: {
    face: ["#ffd0cc", "#e97873", "#ffe3df", "#b84043", "#652126"],
    edgeLight: "#ffe0dc",
    edgeDark: "#5a1f24",
  },
  violet: {
    face: ["#e8d8ff", "#b38ae0", "#f0e5ff", "#7547a3", "#40265f"],
    edgeLight: "#f0e4ff",
    edgeDark: "#37204f",
  },
  orange: {
    face: ["#ffe0be", "#ef9a56", "#ffe9d3", "#c96129", "#6a3212"],
    edgeLight: "#ffe6ca",
    edgeDark: "#592b0f",
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

export function selectedTerritoryMaterial(
  color: PlayerColor,
): TerritorySelectionMaterial {
  return SELECTED_TERRITORY_MATERIALS[color];
}

export function neutralTerritoryMaterial(): TerritoryMaterial {
  return NEUTRAL_TERRITORY_MATERIAL;
}
