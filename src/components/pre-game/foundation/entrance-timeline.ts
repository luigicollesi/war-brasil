export const COMMAND_ENTRANCE_DURATION_MS = 3000;

const ENTRANCE_EASING = Object.freeze({
  x1: 0.4,
  y1: 0.14,
  x2: 0.3,
  y2: 1,
});

function sampleCurve(a1: number, a2: number, t: number) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * a1 + 3 * inverse * t * t * a2 + t * t * t;
}

function sampleCurveDerivative(a1: number, a2: number, t: number) {
  const inverse = 1 - t;
  return (
    3 * inverse * inverse * a1 +
    6 * inverse * t * (a2 - a1) +
    3 * t * t * (1 - a2)
  );
}

function solveCurveParameter(progress: number) {
  let t = progress;

  for (let iteration = 0; iteration < 7; iteration += 1) {
    const error = sampleCurve(ENTRANCE_EASING.x1, ENTRANCE_EASING.x2, t) - progress;
    const derivative = sampleCurveDerivative(
      ENTRANCE_EASING.x1,
      ENTRANCE_EASING.x2,
      t,
    );

    if (Math.abs(error) < 0.00001) return t;
    if (Math.abs(derivative) < 0.00001) break;

    t -= error / derivative;
  }

  let lower = 0;
  let upper = 1;
  t = progress;

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const value = sampleCurve(ENTRANCE_EASING.x1, ENTRANCE_EASING.x2, t);
    if (Math.abs(value - progress) < 0.00001) break;
    if (value < progress) lower = t;
    else upper = t;
    t = (lower + upper) / 2;
  }

  return t;
}

export function getCommandEntranceProgress(
  startedAtMs: number | null,
  nowMs: number,
  durationMs = COMMAND_ENTRANCE_DURATION_MS,
) {
  if (startedAtMs === null) return 0;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 1;

  return Math.min(1, Math.max(0, (nowMs - startedAtMs) / durationMs));
}

export function easeCommandEntrance(progress: number) {
  const clamped = Math.min(1, Math.max(0, progress));
  if (clamped === 0 || clamped === 1) return clamped;

  const parameter = solveCurveParameter(clamped);
  return sampleCurve(ENTRANCE_EASING.y1, ENTRANCE_EASING.y2, parameter);
}
