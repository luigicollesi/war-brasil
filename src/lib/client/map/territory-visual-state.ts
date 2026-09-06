import type { TerritoryVisualNodes } from "@/src/lib/client/map/territory-svg-nodes";

const SVG_NS = "http://www.w3.org/2000/svg";
const RUNTIME_STYLE_ID = "war-territory-runtime-style";

export type TerritoryVisualState = {
  available: boolean;
  target: boolean;
  targetSelectable: boolean;
  selected: boolean;
};

export function ensureTerritoryRuntimeStyles(document: Document) {
  if (document.getElementById(RUNTIME_STYLE_ID)) return;

  const style = document.createElementNS(SVG_NS, "style");
  style.id = RUNTIME_STYLE_ID;
  style.textContent = `
    .territory {
      --territory-stroke-width: .9;
      stroke: #e4dcc0;
      stroke-opacity: .44;
      stroke-width: var(--territory-render-stroke-width, var(--territory-stroke-width));
      filter: none;
      transition: stroke .14s ease, stroke-opacity .14s ease, stroke-width .14s ease;
    }

    .territory.is-available {
      --territory-stroke-width: 1.3;
      stroke: #f2ead2;
      stroke-opacity: .72;
      filter: brightness(1.03) saturate(1.012);
    }

    .territory.is-target {
      --territory-stroke-width: 1.4;
      stroke: #d9c58a;
      stroke-opacity: .74;
      filter: brightness(1.018);
    }

    .territory.is-target-selectable {
      --territory-stroke-width: 1.8;
      stroke: #f0d27b;
      stroke-opacity: .92;
      filter: brightness(1.04) saturate(1.02) drop-shadow(0 0 2.5px rgba(217, 182, 80, .2));
    }

    .territory:hover,
    .territory.is-hovered {
      --territory-stroke-width: 1.6;
      stroke: #fff7df;
      stroke-opacity: .93;
      filter: brightness(1.05) saturate(1.02);
    }

    .territory-depth.is-hovered {
      filter: brightness(1.035) saturate(1.012);
    }

    .territory.is-selected,
    .territory.is-selected:hover,
    .territory.is-selected.is-hovered {
      --territory-stroke-width: 2.2;
      stroke: #fff0c4;
      stroke-opacity: 1;
      filter: brightness(1.05) saturate(1.02) drop-shadow(0 0 3px rgba(217, 182, 80, .3));
    }

    .territory-depth.is-selected {
      filter: brightness(1.025) saturate(1.01);
    }

    .territory-depth.is-selected.is-hovered {
      filter: brightness(1.045) saturate(1.015);
    }

    .territory.is-opening-highlight {
      --territory-stroke-width: 1.8;
      stroke: #fff7df;
      stroke-opacity: .92;
      filter: brightness(1.075) saturate(1.025);
    }

    .territory-depth.is-opening-highlight {
      filter: brightness(1.045) saturate(1.015);
    }

    .territory:focus-visible {
      --territory-stroke-width: 1.9;
      outline: none;
      stroke: #fff7df;
      stroke-opacity: 1;
      filter: brightness(1.05);
    }

    @media (prefers-reduced-motion: reduce) {
      .territory {
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
  face.style.removeProperty("stroke");
  face.style.removeProperty("stroke-width");
  face.style.removeProperty("stroke-opacity");
  face.style.removeProperty("filter");

  face.classList.toggle("is-available", state.available);
  face.classList.toggle("is-target", state.target);
  face.classList.toggle("is-target-selectable", state.targetSelectable);
  face.classList.toggle("is-selected", state.selected);

  for (const depth of nodes.depths) {
    depth.classList.toggle("is-selected", state.selected);
  }
}

export function applyTerritoryHoverState(
  nodes: TerritoryVisualNodes,
  hovered: boolean,
) {
  nodes.face.classList.toggle("is-hovered", hovered);
  for (const depth of nodes.depths) {
    depth.classList.toggle("is-hovered", hovered);
  }
}

export function applyTerritoryOpeningHighlightState(
  nodes: TerritoryVisualNodes,
  highlighted: boolean,
) {
  nodes.face.classList.toggle("is-opening-highlight", highlighted);
  for (const depth of nodes.depths) {
    depth.classList.toggle("is-opening-highlight", highlighted);
  }
}
