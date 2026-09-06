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
      transition: stroke .14s ease, stroke-opacity .14s ease, stroke-width .14s ease, filter .14s ease;
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

    .territory.is-selected,
    .territory.is-selected:hover,
    .territory.is-selected.is-hovered {
      --territory-stroke-width: 2.2;
      stroke: #f0d473;
      stroke-opacity: 1;
      filter: brightness(1.05) saturate(1.02) drop-shadow(0 0 3px rgba(217, 182, 80, .26));
    }

    .territory:focus-visible {
      --territory-stroke-width: 1.9;
      outline: none;
      stroke: #fff7df;
      stroke-opacity: 1;
      filter: brightness(1.05);
    }
  `;

  document.documentElement.appendChild(style);
}

export function applyTerritoryVisualState(
  face: SVGPathElement,
  state: TerritoryVisualState,
) {
  face.style.removeProperty("stroke");
  face.style.removeProperty("stroke-width");
  face.style.removeProperty("stroke-opacity");
  face.style.removeProperty("filter");

  face.classList.toggle("is-available", state.available);
  face.classList.toggle("is-target", state.target);
  face.classList.toggle("is-target-selectable", state.targetSelectable);
  face.classList.toggle("is-selected", state.selected);
}

export function applyTerritoryHoverState(
  face: SVGPathElement,
  hovered: boolean,
) {
  face.classList.toggle("is-hovered", hovered);
}
