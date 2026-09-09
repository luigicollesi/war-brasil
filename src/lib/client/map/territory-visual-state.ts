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

export type TerritoryHighlightKind =
  | "none"
  | "hover"
  | "available"
  | "target-blocked"
  | "target"
  | "selected"
  | "opening";

export function resolveTerritoryHighlightKind(
  face: SVGPathElement,
): TerritoryHighlightKind {
  if (face.classList.contains("is-opening-highlight")) return "opening";
  if (face.classList.contains("is-selected")) return "selected";
  if (face.classList.contains("is-target-selectable")) return "target";
  if (face.classList.contains("is-target")) return "target-blocked";
  if (face.classList.contains("is-available")) return "available";
  if (face.classList.contains("is-hovered")) return "hover";
  return "none";
}

function refreshTerritoryHighlightState(nodes: TerritoryVisualNodes) {
  const kind = resolveTerritoryHighlightKind(nodes.face);
  nodes.face.dataset.highlightKind = kind;
  nodes.highlight.dataset.highlightKind = kind;
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

    /* Neutralize native asset hover/filter rules. Semantic state is resolved
       into data-highlight-kind and rendered by the lightweight state layer. */
    .territory:hover {
      filter: none;
    }

    .territory[data-highlight-kind] {
      filter: none;
    }

    .territory-highlight {
      opacity: 0;
      pointer-events: none;
      transition: opacity .1s ease-out;
    }

    .territory[data-highlight-kind="hover"] {
      --territory-stroke-width: 1.45;
      stroke: var(--territory-highlight-edge, var(--territory-region-stroke, #fff7df));
      stroke-opacity: .78;
    }
    .territory-highlight[data-highlight-kind="hover"] { opacity: .10; }

    .territory[data-highlight-kind="available"] {
      --territory-stroke-width: 1.8;
      stroke: var(--territory-highlight-edge, var(--territory-region-stroke, #fff1bd));
      stroke-opacity: .88;
    }
    .territory-highlight[data-highlight-kind="available"] { opacity: .18; }

    .territory[data-highlight-kind="target-blocked"] {
      --territory-stroke-width: 1.8;
      stroke: var(--territory-highlight-edge, var(--territory-region-stroke, #fff1bd));
      stroke-opacity: .72;
      stroke-dasharray: 5 3;
    }
    .territory-highlight[data-highlight-kind="target-blocked"] { opacity: .13; }

    .territory[data-highlight-kind="target"] {
      --territory-stroke-width: 2.2;
      stroke: var(--territory-highlight-edge, var(--territory-region-stroke, #fff6d6));
      stroke-opacity: 1;
    }
    .territory-highlight[data-highlight-kind="target"] { opacity: .28; }

    .territory[data-highlight-kind="selected"] {
      --territory-stroke-width: 2.7;
      stroke: var(--territory-highlight-edge-strong, var(--territory-highlight-edge, #fff9e8));
      stroke-opacity: 1;
    }
    .territory-highlight[data-highlight-kind="selected"] { opacity: .38; }

    .territory[data-highlight-kind="selected"].is-hovered {
      --territory-stroke-width: 2.9;
    }

    .territory[data-highlight-kind="opening"] {
      --territory-stroke-width: 2.4;
      stroke: var(--territory-highlight-edge-strong, var(--territory-highlight-edge, #fff8df));
      stroke-opacity: 1;
    }
    .territory-highlight[data-highlight-kind="opening"] { opacity: .32; }

    .territory.is-keyboard-focused {
      outline: none;
      stroke: var(--territory-highlight-edge-strong, var(--territory-highlight-edge, #fff8df));
      stroke-opacity: 1;
    }
    .territory[data-highlight-kind="none"].is-keyboard-focused,
    .territory[data-highlight-kind="hover"].is-keyboard-focused {
      --territory-stroke-width: 1.8;
    }
    .territory-highlight[data-highlight-kind="none"].is-keyboard-focused,
    .territory-highlight[data-highlight-kind="hover"].is-keyboard-focused {
      opacity: .12;
    }

    /* Compatibility selector for the 2.5D visual contract. Depth layers stay
       static and never receive semantic state classes. */
    .territory-depth.is-hovered {
      filter: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .territory-highlight {
        transition: none;
      }
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
  refreshTerritoryHighlightState(nodes);
}

export function applyTerritoryHoverState(
  nodes: TerritoryVisualNodes,
  hovered: boolean,
) {
  nodes.face.classList.toggle("is-hovered", hovered);
  refreshTerritoryHighlightState(nodes);
}

export function applyTerritoryKeyboardFocusState(
  nodes: TerritoryVisualNodes,
  focused: boolean,
) {
  nodes.face.classList.toggle("is-keyboard-focused", focused);
  nodes.highlight.classList.toggle("is-keyboard-focused", focused);
  refreshTerritoryHighlightState(nodes);
}
