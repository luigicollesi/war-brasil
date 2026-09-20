export const SHOWCASE_IDLE_REVOLUTION_SECONDS = 8;
export const SHOWCASE_SWIPE_THRESHOLD_PX = 52;
export const SHOWCASE_SWIPE_AXIS_DOMINANCE = 1.15;
export const SHOWCASE_ITEM_TRANSITION_MS = 460;

export type ShowcaseTransitionPhase = "idle" | "slide";

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
  const linear = Math.max(0, Math.min(1, elapsedMs / SHOWCASE_ITEM_TRANSITION_MS));
  return linear * linear * (3 - 2 * linear);
}

export function resolveShowcaseSwipeDirection({
  deltaX,
  deltaY,
}: {
  deltaX: number;
  deltaY: number;
}): -1 | 1 | null {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (horizontalDistance < SHOWCASE_SWIPE_THRESHOLD_PX) return null;
  if (horizontalDistance < verticalDistance * SHOWCASE_SWIPE_AXIS_DOMINANCE) return null;

  return deltaX < 0 ? 1 : -1;
}
