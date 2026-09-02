import type { DiceTrajectoryFrame } from "../types";

const POSITION_DELTA_THRESHOLD = 0.002;
const ROTATION_DELTA_THRESHOLD_RADIANS = 0.008;
const SETTLE_PADDING_FRAMES = 6;
const MIN_ACTIVE_REPLAY_SHARE = 0.84;
const MIN_ACTIVE_PROGRESS_FOR_WARP = 0.82;

export type DiceTrajectoryTiming = {
  activeEndProgress: number;
  activeReplayShare: number;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function quaternionAngularDistance(
  first: readonly [number, number, number, number],
  second: readonly [number, number, number, number],
) {
  const dot = Math.abs(
    first[0] * second[0] +
      first[1] * second[1] +
      first[2] * second[2] +
      first[3] * second[3],
  );
  return 2 * Math.acos(clamp01(dot));
}

function frameHasMaterialMotion(
  previous: DiceTrajectoryFrame,
  current: DiceTrajectoryFrame,
) {
  if (previous.dice.length !== current.dice.length) return true;

  return current.dice.some((state, index) => {
    const before = previous.dice[index];
    if (!before || before.index !== state.index) return true;

    const dx = state.position[0] - before.position[0];
    const dy = state.position[1] - before.position[1];
    const dz = state.position[2] - before.position[2];
    const translationDelta = Math.hypot(dx, dy, dz);
    const rotationDelta = quaternionAngularDistance(
      before.rotation,
      state.rotation,
    );

    return (
      translationDelta > POSITION_DELTA_THRESHOLD ||
      rotationDelta > ROTATION_DELTA_THRESHOLD_RADIANS
    );
  });
}

export function analyzeDiceTrajectoryTiming(
  frames: readonly DiceTrajectoryFrame[],
): DiceTrajectoryTiming {
  if (frames.length < 2) {
    return { activeEndProgress: 1, activeReplayShare: 1 };
  }

  let lastMotionIndex = 1;
  for (let index = 1; index < frames.length; index += 1) {
    if (frameHasMaterialMotion(frames[index - 1], frames[index])) {
      lastMotionIndex = index;
    }
  }

  const finalIndex = frames.length - 1;
  const activeEndIndex = Math.min(
    finalIndex,
    lastMotionIndex + SETTLE_PADDING_FRAMES,
  );
  const activeEndProgress = activeEndIndex / finalIndex;

  if (activeEndProgress >= MIN_ACTIVE_PROGRESS_FOR_WARP) {
    return {
      activeEndProgress,
      activeReplayShare: activeEndProgress,
    };
  }

  return {
    activeEndProgress,
    activeReplayShare: Math.max(MIN_ACTIVE_REPLAY_SHARE, activeEndProgress),
  };
}

export function mapDiceReplayProgress(
  replayProgress: number,
  timing: DiceTrajectoryTiming,
) {
  const progress = clamp01(replayProgress);
  const activeEnd = clamp01(timing.activeEndProgress);
  const activeShare = clamp01(timing.activeReplayShare);

  if (
    activeEnd <= 0 ||
    activeShare <= 0 ||
    activeEnd >= 1 ||
    activeShare >= 1 ||
    Math.abs(activeEnd - activeShare) < 1e-8
  ) {
    return progress;
  }

  if (progress <= activeShare) {
    return (progress / activeShare) * activeEnd;
  }

  const tailProgress = (progress - activeShare) / (1 - activeShare);
  return activeEnd + tailProgress * (1 - activeEnd);
}
