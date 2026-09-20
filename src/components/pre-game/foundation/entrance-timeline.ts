import type { OpeningRecipe } from "./opening-timeline";

export const COMMAND_ENTRANCE_DURATION_MS = 3000;

export const COMMAND_ENTRANCE_RECIPE = {
  id: "home-genesis",
  durationMs: COMMAND_ENTRANCE_DURATION_MS,
  settlingStart: 0.88,
  cues: {
    territoryIngress: { start: 0, end: 0.44 },
    genesis: { start: 0.44, end: 0.82 },
    atmosphere: { start: 0.3, end: 0.94 },
    identity: { start: 0.72, end: 0.98 },
    profileActivation: { start: 0.8, end: 0.99 },
    primaryAction: { start: 0.8, end: 0.99 },
    settling: { start: 0.88, end: 1 },
  },
} as const satisfies OpeningRecipe<
  | "territoryIngress"
  | "genesis"
  | "atmosphere"
  | "identity"
  | "profileActivation"
  | "primaryAction"
  | "settling"
>;
