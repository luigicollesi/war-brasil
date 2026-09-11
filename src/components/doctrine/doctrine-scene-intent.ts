import type { CommandSceneIntent } from "@/src/components/pre-game/foundation";

export const DOCTRINE_SCENE_INTENT = {
  mode: "doctrine",
  focus: "brazil",
  conflictLevel: 0,
  territoryExplode: 0.18,
  orbitalAlignment: 0,
} as const satisfies CommandSceneIntent;
