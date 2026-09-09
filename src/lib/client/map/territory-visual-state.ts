import type { TerritoryVisualNodes } from "@/src/lib/client/map/territory-svg-nodes";

const SVG_NS = "http://www.w3.org/2000/svg";
const RUNTIME_STYLE_ID = "war-territory-runtime-style";

const regionBorders: Record<string, { stroke: string; glow: string }> = {
  norte: { stroke: "#67f58b", glow: "rgba(103,245,139,.9)" },
  nordeste: { stroke: "#63b4ff", glow: "rgba(99,180,255,.9)" },
  "centro-oeste": { stroke: "#ffd84d", glow: "rgba(255,216,77,.9)" },
  sudeste: { stroke: "#ff6262", glow: "rgba(255,98,98,.9)" },
  sul: { stroke: "#ff9a3d", glow: "rgba(255,154,61,.9)" },
};

const fallbackRegionBorder = {
  stroke: "#fff1bd",
  glow: "rgba(255,241,189,.82)",
};

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
  const hovered = face.classList.contains("is-hovered");

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
      --territory-stroke-width: .9;
      stroke: var(--territory-region-stroke, #e4dcc0);
      stroke-opacity: .42;
      stroke-width: var(--territory-render-stroke-width, var(--territory-stroke-width));
      stroke-dasharray: none;
      filter: none;
      transition: none;
    }

    /* The embedded asset still has native hover rules. Interaction owns the
       surface fill and keeps legacy filter effects disabled. */
    .territory:hover {
      filter: none;
    }

    .territory.is-hovered {
      filter: none;
    }

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

    .territory[data-semantic-state="none"].is-hovered {
      --territory-stroke-width: 1.45;
      stroke: var(--territory-highlight-edge, var(--territory-region-stroke, #fff7df));
      stroke-opacity: .82;
    }

    .territory[data-semantic-state="available"] {
      --territory-stroke-width: 1.8;
      stroke: var(--territory-highlight-edge, var(--territory-region-stroke, #fff1bd));
      stroke-opacity: .88;
    }

    .territory[data-semantic-state="target-blocked"] {
      --territory-stroke-width: 1.8;
      stroke: var(--territory-highlight-edge, var(--territory-region-stroke, #fff1bd));
      stroke-opacity: .72;
      stroke-dasharray: 5 3;
    }

    .territory[data-semantic-state="target"] {
      --territory-stroke-width: 2.2;
      stroke: var(--territory-highlight-edge, var(--territory-region-stroke, #fff6d6));
      stroke-opacity: 1;
    }

    .territory[data-semantic-state="selected"] {
      --territory-stroke-width: 2.7;
      stroke: var(--territory-highlight-edge-strong, var(--territory-highlight-edge, #fff9e8));
      stroke-opacity: 1;
    }

    .territory[data-semantic-state="opening"] {
      --territory-stroke-width: 2.4;
      stroke: var(--territory-highlight-edge-strong, var(--territory-highlight-edge, #fff8df));
      stroke-opacity: 1;
    }

    .territory:not([data-semantic-state="none"]).is-hovered {
      stroke: var(--territory-highlight-edge-strong, var(--territory-highlight-edge, #fff8df));
      stroke-opacity: 1;
    }

    .territory[data-semantic-state="selected"].is-hovered {
      --territory-stroke-width: 2.9;
    }

    .territory.is-keyboard-focused {
      outline: none;
      stroke: var(--territory-highlight-edge-strong, var(--territory-highlight-edge, #fff8df));
      stroke-opacity: 1;
    }

    .territory[data-semantic-state="none"].is-keyboard-focused {
      --territory-stroke-width: 1.8;
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
  const regionStyle =
    regionBorders[face.dataset.region ?? ""] ?? fallbackRegionBorder;

  face.style.removeProperty("stroke");
  face.style.removeProperty("stroke-width");
  face.style.removeProperty("stroke-opacity");
  face.style.removeProperty("stroke-dasharray");
  face.style.removeProperty("filter");
  face.style.setProperty("--territory-region-stroke", regionStyle.stroke);
  face.style.setProperty("--territory-region-glow", regionStyle.glow);

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
}
