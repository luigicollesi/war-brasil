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
      filter: none;
      transition: stroke .1s ease, stroke-opacity .1s ease, stroke-width .1s ease;
    }

    /* The asset has legacy :hover rules. Keep hover presentation under the
       semantic interaction layer without invoking SVG filters. */
    .territory:hover {
      --territory-stroke-width: .9;
      stroke: var(--territory-region-stroke, #e4dcc0);
      stroke-opacity: .42;
      filter: none;
    }

    .territory.is-hovered {
      --territory-stroke-width: 1.7;
      stroke: var(--territory-region-stroke, #fff7df);
      stroke-opacity: .9;
    }

    /* Compatibility selector for the 2.5D visual contract. Depth layers stay
       static: interaction no longer toggles this class or applies effects. */
    .territory-depth.is-hovered {
      filter: none;
    }

    .territory.is-available {
      --territory-stroke-width: 2.1;
      stroke: var(--territory-region-stroke, #fff1bd);
      stroke-opacity: .96;
    }

    .territory.is-target {
      --territory-stroke-width: 2.25;
      stroke: var(--territory-region-stroke, #fff1bd);
      stroke-opacity: 1;
    }

    .territory.is-target-selectable {
      --territory-stroke-width: 2.8;
      stroke: var(--territory-region-stroke, #fff6d6);
      stroke-opacity: 1;
    }

    .territory.is-opening-highlight {
      --territory-stroke-width: 2.9;
      stroke: var(--territory-region-stroke, #fff8df);
      stroke-opacity: 1;
    }

    .territory.is-selected {
      --territory-stroke-width: 3.4;
      stroke: var(--territory-region-stroke, #fff9e8);
      stroke-opacity: 1;
    }

    .territory.is-selected.is-hovered {
      --territory-stroke-width: 3.55;
      stroke-opacity: 1;
    }

    .territory.is-keyboard-focused {
      outline: none;
      --territory-stroke-width: 2.7;
      stroke: var(--territory-region-stroke, #fff8df);
      stroke-opacity: 1;
    }

    .territory.is-selected.is-keyboard-focused {
      --territory-stroke-width: 3.6;
      stroke-opacity: 1;
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
  const regionStyle =
    regionBorders[face.dataset.region ?? ""] ?? fallbackRegionBorder;

  face.style.removeProperty("stroke");
  face.style.removeProperty("stroke-width");
  face.style.removeProperty("stroke-opacity");
  face.style.removeProperty("filter");
  face.style.setProperty("--territory-region-stroke", regionStyle.stroke);
  face.style.setProperty("--territory-region-glow", regionStyle.glow);

  face.classList.toggle("is-available", state.available);
  face.classList.toggle("is-target", state.target);
  face.classList.toggle("is-target-selectable", state.targetSelectable);
  face.classList.toggle("is-selected", state.selected);
  face.classList.toggle("is-opening-highlight", state.openingHighlight);
}

export function applyTerritoryHoverState(
  nodes: TerritoryVisualNodes,
  hovered: boolean,
) {
  nodes.face.classList.toggle("is-hovered", hovered);
}

export function applyTerritoryKeyboardFocusState(
  nodes: TerritoryVisualNodes,
  focused: boolean,
) {
  nodes.face.classList.toggle("is-keyboard-focused", focused);
}
