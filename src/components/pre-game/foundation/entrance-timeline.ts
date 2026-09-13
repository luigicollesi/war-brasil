import type { OpeningRecipe } from "./opening-timeline";

export const COMMAND_ENTRANCE_DURATION_MS = 3000;

export const COMMAND_ENTRANCE_RECIPE = {
  id: "home-genesis",
  durationMs: COMMAND_ENTRANCE_DURATION_MS,
  settlingStart: 0.86,
  cues: {
    canonicalRead: { start: 0, end: 0.12 },
    borderActivation: { start: 0.08, end: 0.42 },
    materialization: { start: 0.16, end: 0.82 },
    atmosphere: { start: 0.28, end: 0.88 },
    identity: { start: 0.4, end: 0.92 },
    primaryAction: { start: 0.56, end: 0.96 },
    settling: { start: 0.86, end: 1 },
  },
} as const satisfies OpeningRecipe<
  | "canonicalRead"
  | "borderActivation"
  | "materialization"
  | "atmosphere"
  | "identity"
  | "primaryAction"
  | "settling"
>;
