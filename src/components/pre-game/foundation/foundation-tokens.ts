export const COMMAND_FOUNDATION_TOKENS = Object.freeze({
  color: {
    void: "#070a08",
    coal: "#101713",
    militaryDeep: "#17231b",
    military: "#28372b",
    militaryRaised: "#354638",
    brass: "#9d793b",
    brassBright: "#d0aa57",
    conflict: "#8b2026",
    conflictBright: "#b53137",
    ivory: "#eee8da",
    muted: "#9b9b90",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 40,
  },
  depth: {
    scene: 0,
    atmosphere: 2,
    content: 10,
    chrome: 20,
  },
  material: {
    panelBlurPx: 8,
    plateMetalness: 0.34,
    plateRoughness: 0.58,
    brassMetalness: 0.78,
  },
  motion: {
    cameraDamping: 4.2,
    objectDamping: 3.1,
    crownTurnsPerSecond: 0.0025,
  },
  scene: {
    mapScale: 0.0052,
    maxDesktopDpr: 1.5,
    maxReducedDpr: 1.1,
  },
} as const);

export type CommandFoundationTokens = typeof COMMAND_FOUNDATION_TOKENS;
