import { COMMAND_ENTRANCE_DURATION_MS } from "./entrance-timeline";

export const COMMAND_SCENE_MODES = [
  "entrance",
  "operations",
  "lobby",
  "doctrine",
  "profile",
] as const;

export type CommandSceneMode = (typeof COMMAND_SCENE_MODES)[number];

export const COMMAND_SCENE_FOCUSES = [
  "earth",
  "brazil",
  "table",
  "insignia",
  "none",
] as const;

export type CommandSceneFocus = (typeof COMMAND_SCENE_FOCUSES)[number];
export type CommandConflictLevel = 0 | 1 | 2 | 3;
export type CommandOrbitalAlignment = 0 | 1;
export type CommandSceneState = "loading" | "ready" | "fallback";

export type CommandSceneIntent = Readonly<{
  mode: CommandSceneMode;
  focus?: CommandSceneFocus;
  conflictLevel?: CommandConflictLevel;
  territoryExplode?: number;
  orbitalAlignment?: CommandOrbitalAlignment;
  entranceStartedAtMs?: number | null;
  entranceDurationMs?: number;
}>;

export type NormalizedCommandSceneIntent = Readonly<{
  mode: CommandSceneMode;
  focus: CommandSceneFocus;
  conflictLevel: CommandConflictLevel;
  territoryExplode: number;
  orbitalAlignment: CommandOrbitalAlignment;
  entranceStartedAtMs: number | null;
  entranceDurationMs: number;
}>;

const DEFAULT_FOCUS_BY_MODE: Readonly<Record<CommandSceneMode, CommandSceneFocus>> = {
  entrance: "earth",
  operations: "brazil",
  lobby: "table",
  doctrine: "brazil",
  profile: "insignia",
};

export const DEFAULT_COMMAND_SCENE_INTENT: NormalizedCommandSceneIntent = {
  mode: "entrance",
  focus: "earth",
  conflictLevel: 0,
  territoryExplode: 0,
  orbitalAlignment: 0,
  entranceStartedAtMs: null,
  entranceDurationMs: COMMAND_ENTRANCE_DURATION_MS,
};

export function normalizeCommandSceneIntent(
  intent: CommandSceneIntent,
): NormalizedCommandSceneIntent {
  const explode = Number.isFinite(intent.territoryExplode)
    ? Math.min(1, Math.max(0, intent.territoryExplode ?? 0))
    : 0;
  const entranceStartedAtMs = Number.isFinite(intent.entranceStartedAtMs)
    ? (intent.entranceStartedAtMs ?? null)
    : null;
  const entranceDurationMs = Number.isFinite(intent.entranceDurationMs)
    ? Math.min(10_000, Math.max(250, intent.entranceDurationMs ?? COMMAND_ENTRANCE_DURATION_MS))
    : COMMAND_ENTRANCE_DURATION_MS;

  return {
    mode: intent.mode,
    focus: intent.focus ?? DEFAULT_FOCUS_BY_MODE[intent.mode],
    conflictLevel: intent.conflictLevel ?? 0,
    territoryExplode: explode,
    orbitalAlignment: intent.orbitalAlignment ?? 0,
    entranceStartedAtMs,
    entranceDurationMs,
  };
}

export const COMMAND_SCENE_MODE_LABELS: Readonly<Record<CommandSceneMode, string>> = {
  entrance: "ENTRADA",
  operations: "OPERAÇÕES",
  lobby: "BRIEFING",
  doctrine: "DOUTRINA",
  profile: "SALÃO DE COMANDO",
};
