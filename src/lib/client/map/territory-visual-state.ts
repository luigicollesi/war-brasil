import type { TerritoryVisualNodes } from "@/src/lib/client/map/territory-svg-nodes";

const SVG_NS = "http://www.w3.org/2000/svg";
const RUNTIME_STYLE_ID = "war-territory-runtime-style";

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

export function resolveTerritorySemanticState(
  face: SVGPathElement,
): TerritorySemanticState {
  if (face.classList.contains("is-opening-highlight")) return "opening";
  if (face.classList.contains("is-selected")) return "selected";
  if (face.classList.contains("is-target-selectable")) return "target";
  if (face.classList.contains("is-target")) return "target-blocked";
  if (face.classList.contains("is-available")) return "available";
  return "none";
}

export function resolveTerritorySurfaceState(
  face: SVGPathElement,
  semanticState = resolveTerritorySemanticState(face),
): TerritorySurfaceState {
  const highlighted = semanticState !== "none";
  const hovered =
    face.classList.contains("is-hovered") ||
    face.classList.contains("is-keyboard-focused");

  if (highlighted && hovered) return "highlighted-hover";
  if (highlighted) return "highlighted";
  if (hovered) return "hover";
  return "normal";
}

function refreshTerritoryVisualState(nodes: TerritoryVisualNodes) {
  const semanticState = resolveTerritorySemanticState(nodes.face);
  nodes.face.dataset.semanticState = semanticState;
  nodes.face.dataset.surfaceState = resolveTerritorySurfaceState(
    nodes.face,
    semanticState,
  );
}

export function ensureTerritoryRuntimeStyles(document: Document) {
  if (document.getElementById(RUNTIME_STYLE_ID)) return;

  const style = document.createElementNS(SVG_NS, "style");
  style.id = RUNTIME_STYLE_ID;
  style.textContent = `
    .territory {
      stroke: var(--territory-region-stroke, #e4dcc0);
      stroke-opacity: .42;
      stroke-width: var(--territory-render-stroke-width, .9);
      stroke-dasharray: none;
      filter: none;
      transition: none;
    }

    /* Region borders are static. Gameplay state only changes the face fill. */
    .territory[data-region="norte"] {
      --territory-region-stroke: #67f58b;
    }

    .territory[data-region="nordeste"] {
      --territory-region-stroke: #63b4ff;
    }

    .territory[data-region="centro-oeste"] {
      --territory-region-stroke: #ffd84d;
    }

    .territory[data-region="sudeste"] {
      --territory-region-stroke: #ff6262;
    }

    .territory[data-region="sul"] {
      --territory-region-stroke: #ff9a3d;
    }

    /* The embedded asset still has native hover rules. Interaction owns the
       surface fill and keeps legacy filter effects disabled. */
    .territory:hover,
    .territory.is-hovered,
    .territory.is-keyboard-focused,
    .territory[data-surface-state] {
      filter: none;
    }

    .territory[data-surface-state="hover"] {
      fill: var(--territory-hover-fill, var(--territory-base-fill));
    }

    .territory[data-surface-state="highlighted"] {
      fill: var(--territory-highlight-fill, var(--territory-base-fill));
    }

    .territory[data-surface-state="highlighted-hover"] {
      fill: var(--territory-highlight-hover-fill, var(--territory-highlight-fill, var(--territory-base-fill)));
    }

    /* Compatibility selector for the 2.5D visual contract. Depth layers stay
       static and never receive semantic state classes. */
    .territory-depth.is-hovered {
      filter: none;
    }
  `;

  document.documentElement.appendChild(style);
}

export function applyTerritoryVisualState(
  nodes: TerritoryVisualNodes,
  state: TerritoryVisualState,
) {
  const face = nodes.face;

  face.classList.toggle("is-available", state.available);
  face.classList.toggle("is-target", state.target);
  face.classList.toggle("is-target-selectable", state.targetSelectable);
  face.classList.toggle("is-selected", state.selected);
  face.classList.toggle("is-opening-highlight", state.openingHighlight);
  refreshTerritoryVisualState(nodes);
}

export function applyTerritoryHoverState(
  nodes: TerritoryVisualNodes,
  hovered: boolean,
) {
  nodes.face.classList.toggle("is-hovered", hovered);
  refreshTerritoryVisualState(nodes);
}

export function applyTerritoryKeyboardFocusState(
  nodes: TerritoryVisualNodes,
  focused: boolean,
) {
  nodes.face.classList.toggle("is-keyboard-focused", focused);
  refreshTerritoryVisualState(nodes);
}
