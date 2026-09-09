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
    .territory,
    .territory-depth,
    .territory-deep-rim,
    .territory-bevel-light,
    .territory-bevel-dark {
      transition: filter .13s ease;
    }

    .territory {
      --territory-stroke-width: .9;
      stroke: var(--territory-region-stroke, #e4dcc0);
      stroke-opacity: .42;
      stroke-width: var(--territory-render-stroke-width, var(--territory-stroke-width));
      filter: none;
      transition: filter .13s ease, stroke .13s ease, stroke-opacity .13s ease, stroke-width .13s ease;
    }

    /* The asset has legacy :hover rules. Neutralize browser-native hover so
       only the semantic .is-hovered state chosen by the interaction layer can
       change the piece appearance. */
    .territory:hover {
      --territory-stroke-width: .9;
      stroke: var(--territory-region-stroke, #e4dcc0);
      stroke-opacity: .42;
      filter: none;
    }

    .territory.is-hovered {
      --territory-stroke-width: 1.8;
      stroke: var(--territory-region-stroke, #fff7df);
      stroke-opacity: .94;
      filter: brightness(1.12) saturate(1.18) drop-shadow(0 0 3px var(--territory-region-glow, rgba(217, 182, 80, .4)));
    }

    .territory-depth.is-hovered {
      filter: brightness(1.06) saturate(1.08);
    }

    .territory.is-available {
      --territory-stroke-width: 2.2;
      stroke: var(--territory-region-stroke, #fff1bd);
      stroke-opacity: 1;
      filter: brightness(1.22) saturate(1.35) drop-shadow(0 0 3px var(--territory-region-glow, rgba(217, 182, 80, .58))) drop-shadow(0 0 6px var(--territory-region-glow, rgba(217, 182, 80, .42)));
    }

    .territory-depth.is-available {
      filter: brightness(1.09) saturate(1.12);
    }

    .territory.is-target {
      --territory-stroke-width: 2.15;
      stroke: var(--territory-region-stroke, #fff1bd);
      stroke-opacity: 1;
      filter: brightness(1.19) saturate(1.3) drop-shadow(0 0 3px var(--territory-region-glow, rgba(217, 182, 80, .54))) drop-shadow(0 0 5px var(--territory-region-glow, rgba(217, 182, 80, .38)));
    }

    .territory-depth.is-target {
      filter: brightness(1.085) saturate(1.1);
    }

    .territory.is-target-selectable {
      --territory-stroke-width: 2.8;
      stroke: var(--territory-region-stroke, #fff6d6);
      stroke-opacity: 1;
      filter: brightness(1.32) saturate(1.55) drop-shadow(0 0 4px var(--territory-region-glow, rgba(217, 182, 80, .72))) drop-shadow(0 0 9px var(--territory-region-glow, rgba(217, 182, 80, .56)));
    }

    .territory-depth.is-target-selectable {
      filter: brightness(1.13) saturate(1.18);
    }

    .territory.is-opening-highlight {
      --territory-stroke-width: 2.9;
      stroke: var(--territory-region-stroke, #fff8df);
      stroke-opacity: 1;
      filter: brightness(1.34) saturate(1.58) drop-shadow(0 0 4px var(--territory-region-glow, rgba(255, 247, 223, .74))) drop-shadow(0 0 9px var(--territory-region-glow, rgba(255, 247, 223, .58)));
    }

    .territory-depth.is-opening-highlight {
      filter: brightness(1.14) saturate(1.19);
    }

    .territory.is-selected {
      --territory-stroke-width: 3.4;
      stroke: var(--territory-region-stroke, #fff9e8);
      stroke-opacity: 1;
      filter: brightness(1.4) saturate(1.7) drop-shadow(0 0 5px var(--territory-region-glow, rgba(217, 182, 80, .82))) drop-shadow(0 0 11px var(--territory-region-glow, rgba(217, 182, 80, .66)));
    }

    .territory-depth.is-selected {
      filter: brightness(1.17) saturate(1.22);
    }

    .territory-depth.is-selected.is-hovered {
      filter: brightness(1.19) saturate(1.25);
    }

    .territory.is-selected.is-hovered {
      filter: brightness(1.43) saturate(1.74) drop-shadow(0 0 5px var(--territory-region-glow, rgba(217, 182, 80, .86))) drop-shadow(0 0 12px var(--territory-region-glow, rgba(217, 182, 80, .7)));
    }

    .territory.is-keyboard-focused {
      outline: none;
      --territory-stroke-width: 2.6;
      stroke: var(--territory-region-stroke, #fff8df);
      stroke-opacity: 1;
      filter: brightness(1.28) saturate(1.42) drop-shadow(0 0 4px var(--territory-region-glow, rgba(255, 247, 223, .64))) drop-shadow(0 0 7px var(--territory-region-glow, rgba(255, 247, 223, .48)));
    }

    .territory.is-selected.is-keyboard-focused {
      filter: brightness(1.43) saturate(1.74) drop-shadow(0 0 5px var(--territory-region-glow, rgba(217, 182, 80, .86))) drop-shadow(0 0 12px var(--territory-region-glow, rgba(217, 182, 80, .7)));
    }

    @media (prefers-reduced-motion: reduce) {
      .territory,
      .territory-depth,
      .territory-deep-rim,
      .territory-bevel-light,
      .territory-bevel-dark {
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

  for (const depth of nodes.depths) {
    depth.classList.toggle("is-available", state.available);
    depth.classList.toggle("is-target", state.target);
    depth.classList.toggle("is-target-selectable", state.targetSelectable);
    depth.classList.toggle("is-selected", state.selected);
    depth.classList.toggle("is-opening-highlight", state.openingHighlight);
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

export function applyTerritoryKeyboardFocusState(
  nodes: TerritoryVisualNodes,
  focused: boolean,
) {
  nodes.face.classList.toggle("is-keyboard-focused", focused);
}
