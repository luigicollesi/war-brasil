export const SHOWCASE_IDLE_REVOLUTION_SECONDS = 8;
export const SHOWCASE_INTERACTION_RESUME_MS = 900;
export const SHOWCASE_DRAG_RADIANS_PER_PIXEL = 0.008;
export const SHOWCASE_MAX_PITCH = Math.PI * 0.28;
export const SHOWCASE_ITEM_TRANSITION_MS = 300;
export const SHOWCASE_ITEM_TRANSITION_PHASE_MS = SHOWCASE_ITEM_TRANSITION_MS / 2;

export type ShowcaseTransitionPhase = "idle" | "exit" | "enter";

export function idleAngularVelocity({
  prefersReducedMotion,
}: {
  prefersReducedMotion: boolean;
}) {
  if (prefersReducedMotion) return 0;
  return (Math.PI * 2) / SHOWCASE_IDLE_REVOLUTION_SECONDS;
}

export function showcaseTransitionProgress({
  elapsedMs,
  prefersReducedMotion,
}: {
  elapsedMs: number;
  prefersReducedMotion: boolean;
}) {
  if (prefersReducedMotion) return 1;
  const linear = Math.max(0, Math.min(1, elapsedMs / SHOWCASE_ITEM_TRANSITION_PHASE_MS));
  return 1 - Math.pow(1 - linear, 3);
}

export function resolveShowcaseDragRotation({
  yaw,
  pitch,
  deltaX,
  deltaY,
}: {
  yaw: number;
  pitch: number;
  deltaX: number;
  deltaY: number;
}) {
  return {
    yaw: yaw + deltaX * SHOWCASE_DRAG_RADIANS_PER_PIXEL,
    pitch: Math.max(
      -SHOWCASE_MAX_PITCH,
      Math.min(SHOWCASE_MAX_PITCH, pitch + deltaY * SHOWCASE_DRAG_RADIANS_PER_PIXEL),
    ),
  };
}
