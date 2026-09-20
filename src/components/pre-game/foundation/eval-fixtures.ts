import type { CommandSceneIntent } from "./scene-contract";

export const FOUNDATION_EVAL_VIEWPORTS = Object.freeze({
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
  wide: { width: 1920, height: 1080 },
} as const);

export const FOUNDATION_EVAL_SCENES = Object.freeze({
  "entrance-idle": {
    mode: "entrance",
    focus: "earth",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 0,
  },
  "operations-focus": {
    mode: "operations",
    focus: "brazil",
    conflictLevel: 0,
    territoryExplode: 0.08,
    orbitalAlignment: 0,
  },
  lobby: {
    mode: "lobby",
    focus: "table",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 0,
  },
  doctrine: {
    mode: "doctrine",
    focus: "brazil",
    conflictLevel: 0,
    territoryExplode: 0.18,
    orbitalAlignment: 0,
  },
  profile: {
    mode: "profile",
    focus: "insignia",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 0,
  },
  "conflict-authorized": {
    mode: "lobby",
    focus: "table",
    conflictLevel: 3,
    territoryExplode: 0.12,
    orbitalAlignment: 1,
  },
} as const satisfies Readonly<Record<string, CommandSceneIntent>>);

export const FOUNDATION_EVAL_ENVIRONMENT_STATES = Object.freeze([
  "reduced-motion",
  "fallback",
] as const);
