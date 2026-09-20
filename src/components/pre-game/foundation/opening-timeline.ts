export type OpeningCueWindow = Readonly<{
  start: number;
  end: number;
}>;

export type OpeningRecipe<TCue extends string = string> = Readonly<{
  id: string;
  durationMs: number;
  settlingStart: number;
  cues: Readonly<Record<TCue, OpeningCueWindow>>;
}>;

export type OpeningRuntimePhase =
  | "primed"
  | "playing"
  | "settling"
  | "settled";

declare global {
  interface Window {
    __WAR_OPENING_SEEK__?: Record<string, number | undefined>;
  }
}

export function clampOpeningProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function smoothOpeningProgress(value: number) {
  const progress = clampOpeningProgress(value);
  return progress * progress * (3 - 2 * progress);
}

export function smootherOpeningProgress(value: number) {
  const progress = clampOpeningProgress(value);
  return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
}

export function sampleOpeningCue(
  progress: number,
  cue: OpeningCueWindow,
) {
  const span = Math.max(cue.end - cue.start, Number.EPSILON);
  return smoothOpeningProgress((progress - cue.start) / span);
}

export function sampleContinuousOpeningCue(
  progress: number,
  cue: OpeningCueWindow,
) {
  const span = Math.max(cue.end - cue.start, Number.EPSILON);
  return smootherOpeningProgress((progress - cue.start) / span);
}

export function resolveOpeningProgress(
  nowMs: number,
  startedAtMs: number,
  durationMs: number,
) {
  return clampOpeningProgress((nowMs - startedAtMs) / durationMs);
}

export function deterministicOpeningSeed(id: number) {
  const value = Math.sin(id * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function readOpeningSeek(recipeId: string) {
  if (typeof window === "undefined") return null;
  const raw = window.__WAR_OPENING_SEEK__?.[recipeId];
  return typeof raw === "number" && Number.isFinite(raw)
    ? clampOpeningProgress(raw)
    : null;
}
