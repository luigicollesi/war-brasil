import type { TerritoryVisualNodes } from "@/src/lib/client/map/territory-svg-nodes";

const SVG_NS = "http://www.w3.org/2000/svg";
const RUNTIME_STYLE_ID = "war-territory-runtime-style";
const SURFACE_FILL_PROPERTY = "--territory-state-fill";

export type TerritoryVisualState = {
  available: boolean;
  target: boolean;
  targetSelectable: boolean;
  selected: boolean;
  openingHighlight: boolean;
};

export type TerritorySemanticState =
  | "none"
  | "available"
  | "target-blocked"
  | "target"
  | "selected"
  | "opening";

export type TerritorySurfaceState =
  | "normal"
  | "hover"
  | "highlighted"
  | "highlighted-hover";

type TerritoryRuntimeVisualState = {
  semanticState: TerritorySemanticState;
  hovered: boolean;
  keyboardFocused: boolean;
  surfaceState: TerritorySurfaceState;
};

const runtimeStateByFace = new WeakMap<SVGPathElement, TerritoryRuntimeVisualState>();

function runtimeState(face: SVGPathElement): TerritoryRuntimeVisualState {
  const existing = runtimeStateByFace.get(face);
  if (existing) return existing;

  const initial: TerritoryRuntimeVisualState = {
    semanticState: "none",
    hovered: false,
    keyboardFocused: false,
    surfaceState: "normal",
  };
  runtimeStateByFace.set(face, initial);
  return initial;
}

function semanticStateFromVisualState(
  state: TerritoryVisualState,
): TerritorySemanticState {
  if (state.openingHighlight) return "opening";
  if (state.selected) return "selected";
  if (state.targetSelectable) return "target";
  if (state.target) return "target-blocked";
  if (state.available) return "available";
  return "none";
}

export function resolveTerritorySemanticState(
  face: SVGPathElement,
): TerritorySemanticState {
  return runtimeStateByFace.get(face)?.semanticState ?? "none";
}

export function resolveTerritorySurfaceState(
  face: SVGPathElement,
  semanticState = resolveTerritorySemanticState(face),
): TerritorySurfaceState {
  const state = runtimeStateByFace.get(face);
  const highlighted = semanticState !== "none";
  const hovered = Boolean(state?.hovered || state?.keyboardFocused);

  if (highlighted && hovered) return "highlighted-hover";
  if (highlighted) return "highlighted";
  if (hovered) return "hover";
  return "normal";
}

function fillForSurfaceState(surfaceState: TerritorySurfaceState) {
  if (surfaceState === "highlighted-hover") {
    return "var(--territory-highlight-hover-fill, var(--territory-highlight-fill, var(--territory-base-fill)))";
  }
  if (surfaceState === "highlighted") {
    return "var(--territory-highlight-fill, var(--territory-base-fill))";
  }
  if (surfaceState === "hover") {
    return "var(--territory-hover-fill, var(--territory-base-fill))";
  }
  return "var(--territory-base-fill)";
}

function syncTerritorySurfaceFill(face: SVGPathElement) {
  const state = runtimeState(face);
  const surfaceState = resolveTerritorySurfaceState(face, state.semanticState);
  if (state.surfaceState === surfaceState && face.style.getPropertyValue(SURFACE_FILL_PROPERTY)) {
    return;
  }

  state.surfaceState = surfaceState;
  const nextFill = fillForSurfaceState(surfaceState);
  if (face.style.getPropertyValue(SURFACE_FILL_PROPERTY) !== nextFill) {
    face.style.setProperty(SURFACE_FILL_PROPERTY, nextFill);
  }
}

export function ensureTerritoryRuntimeStyles(document: Document) {
  if (document.getElementById(RUNTIME_STYLE_ID)) return;

  const style = document.createElementNS(SVG_NS, "style");
  style.id = RUNTIME_STYLE_ID;
  style.textContent = `
    .territory,
    .territory:hover,
    .territory:focus {
      fill: var(${SURFACE_FILL_PROPERTY}, var(--territory-base-fill)) !important;
      stroke: #d9d2bd;
      stroke-opacity: .3;
      stroke-width: var(--territory-render-stroke-width, .9);
      stroke-dasharray: none;
      filter: none !important;
      transition: none;
    }

    .territory-depth {
      filter: none;
    }
  `;

  document.documentElement.appendChild(style);
}

export function applyTerritoryVisualState(
  nodes: TerritoryVisualNodes,
  state: TerritoryVisualState,
) {
  const runtime = runtimeState(nodes.face);
  runtime.semanticState = semanticStateFromVisualState(state);
  syncTerritorySurfaceFill(nodes.face);
}

export function applyTerritoryHoverState(
  nodes: TerritoryVisualNodes,
  hovered: boolean,
) {
  const runtime = runtimeState(nodes.face);
  if (runtime.hovered === hovered) return;
  runtime.hovered = hovered;
  syncTerritorySurfaceFill(nodes.face);
}

export function applyTerritoryKeyboardFocusState(
  nodes: TerritoryVisualNodes,
  focused: boolean,
) {
  const runtime = runtimeState(nodes.face);
  if (runtime.keyboardFocused === focused) return;
  runtime.keyboardFocused = focused;
  syncTerritorySurfaceFill(nodes.face);
}
