import type { PlayerColor } from "@/src/lib/lobby";

export type TerritoryMaterial = {
  face: readonly [string, string, string, string, string];
  side: readonly [string, string, string];
  rim: string;
};

const TERRITORY_MATERIALS: Record<PlayerColor, TerritoryMaterial> = {
  forest: {
    face: ["#58aa83", "#50a07a", "#499571", "#468b6a", "#438264"],
    side: ["#3b6b54", "#355f4b", "#305242"],
    rim: "#284135",
  },
  ocean: {
    face: ["#5e9cd3", "#4f94d1", "#408bce", "#3785ca", "#347ec0"],
    side: ["#316ea5", "#2e6596", "#2c5c87"],
    rim: "#274e72",
  },
  sun: {
    face: ["#dcad28", "#d1a421", "#c3981d", "#b78f1c", "#ab861c"],
    side: ["#8e701a", "#7e6418", "#6e5716"],
    rim: "#584613",
  },
  ruby: {
    face: ["#d07372", "#cc6464", "#c95655", "#c54e4d", "#c04544"],
    side: ["#a93e3d", "#9b3a39", "#8c3737"],
    rim: "#783231",
  },
  violet: {
    face: ["#a683c9", "#9d76c4", "#9468c0", "#8e60bb", "#8758b6"],
    side: ["#784da3", "#6f4896", "#664488"],
    rim: "#593e75",
  },
  orange: {
    face: ["#d7854c", "#d57b3c", "#d3712c", "#c76c2b", "#bc662a"],
    side: ["#a05927", "#905125", "#814923"],
    rim: "#6b3e1f",
  },
};

const NEUTRAL_TERRITORY_MATERIAL: TerritoryMaterial = {
  face: ["#939c98", "#8b9490", "#828b87", "#79827e", "#717a76"],
  side: ["#626b67", "#58605d", "#4d5552"],
  rim: "#3f4744",
};

export function territoryMaterial(color: PlayerColor): TerritoryMaterial {
  return TERRITORY_MATERIALS[color];
}

export function neutralTerritoryMaterial(): TerritoryMaterial {
  return NEUTRAL_TERRITORY_MATERIAL;
}
