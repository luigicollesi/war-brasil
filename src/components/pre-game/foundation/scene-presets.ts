import type {
  CommandSceneFocus,
  CommandSceneMode,
  NormalizedCommandSceneIntent,
} from "./scene-contract";

type Vector3Tuple = readonly [number, number, number];

type SceneModePreset = Readonly<{
  camera: Vector3Tuple;
  target: Vector3Tuple;
  fov: number;
}>;

export type CommandCameraPose = SceneModePreset;

const MODE_PRESETS: Readonly<Record<CommandSceneMode, SceneModePreset>> = {
  entrance: {
    camera: [-0.8, 0.8, 11.7],
    target: [-1.15, 0.15, 0],
    fov: 38,
  },
  operations: {
    camera: [0.7, 1.25, 10.2],
    target: [0.7, -0.2, 0],
    fov: 34,
  },
  lobby: {
    camera: [0.35, 2.1, 10.6],
    target: [0.45, -0.15, -0.1],
    fov: 33,
  },
  doctrine: {
    camera: [0.15, 3.15, 10.4],
    target: [0.4, -0.15, 0],
    fov: 31,
  },
  profile: {
    camera: [3.6, 1.75, 9.8],
    target: [2.45, 0.65, 0],
    fov: 32,
  },
};

const COMPACT_MODE_PRESETS: Readonly<Record<CommandSceneMode, SceneModePreset>> = {
  entrance: {
    camera: [0.15, 1.35, 14.8],
    target: [0.2, 0.65, 0],
    fov: 42,
  },
  operations: {
    camera: [1.05, 1.55, 14.4],
    target: [1.05, 0.55, 0],
    fov: 40,
  },
  lobby: {
    camera: [1.1, 2.2, 14.7],
    target: [1.05, 0.55, -0.05],
    fov: 39,
  },
  doctrine: {
    camera: [0.9, 2.9, 14.9],
    target: [1.05, 0.55, 0],
    fov: 38,
  },
  profile: {
    camera: [2.2, 2, 14.4],
    target: [1.8, 1.2, 0],
    fov: 39,
  },
};

const FOCUS_TARGETS: Readonly<Record<CommandSceneFocus, Vector3Tuple | null>> = {
  earth: [-2.8, 0.75, 0.15],
  brazil: [0.75, -0.25, 0.15],
  table: [0.25, -0.15, -0.2],
  insignia: [2.9, 1.05, 0.15],
  none: null,
};

const COMPACT_FOCUS_TARGETS: Readonly<
  Record<CommandSceneFocus, Vector3Tuple | null>
> = {
  earth: [-1.35, 1.85, 0.15],
  brazil: [1.05, 0.55, 0.15],
  table: [1.05, 0.55, -0.2],
  insignia: [2.4, 1.65, 0.15],
  none: null,
};

export function resolveCommandCameraPose(
  intent: NormalizedCommandSceneIntent,
  compact = false,
): CommandCameraPose {
  const presets = compact ? COMPACT_MODE_PRESETS : MODE_PRESETS;
  const focusTargets = compact ? COMPACT_FOCUS_TARGETS : FOCUS_TARGETS;
  const mode = presets[intent.mode];

  return {
    camera: mode.camera,
    target: focusTargets[intent.focus] ?? mode.target,
    fov: mode.fov,
  };
}
