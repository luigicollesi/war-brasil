import type { OpeningRecipe } from "./opening-timeline";

export const COMMAND_ENTRANCE_DURATION_MS = 3000;

export const COMMAND_ENTRANCE_RECIPE = {
  id: "home-genesis",
  durationMs: COMMAND_ENTRANCE_DURATION_MS,
  settlingStart: 0.88,
  cues: {
    territoryIngress: { start: 0, end: 0.44 },
    genesis: { start: 0.44, end: 0.96 },
    atmosphere: { start: 0.3, end: 0.92 },
    identity: { start: 0.5, end: 0.94 },
    primaryAction: { start: 0.62, end: 0.98 },
    settling: { start: 0.88, end: 1 },
  },
} as const satisfies OpeningRecipe<
  | "territoryIngress"
  | "genesis"
  | "atmosphere"
  | "identity"
  | "primaryAction"
  | "settling"
>;
