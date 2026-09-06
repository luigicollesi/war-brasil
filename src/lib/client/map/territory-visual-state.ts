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
      stroke: #e4dcc0;
      stroke-opacity: .48;
      stroke-width: .95;
      filter: none;
      transition: stroke .14s ease, stroke-opacity .14s ease, stroke-width .14s ease;
    }

    .territory.is-available {
      stroke: #f2ead2;
      stroke-opacity: .76;
      stroke-width: 1.45;
      filter: brightness(1.035) saturate(1.015);
    }

    .territory.is-target {
      stroke: #d9c58a;
      stroke-opacity: .78;
      stroke-width: 1.55;
      filter: brightness(1.02);
    }

    .territory.is-target-selectable {
      stroke: #efcf70;
      stroke-opacity: .94;
      stroke-width: 2.05;
      filter: brightness(1.045) saturate(1.025) drop-shadow(0 0 3px rgba(217, 182, 80, .24));
    }

    .territory:hover {
      stroke: #fff7df;
      stroke-opacity: .96;
      stroke-width: 1.9;
      filter: brightness(1.065) saturate(1.025);
    }

    .territory.is-selected,
    .territory.is-selected:hover {
      stroke: #e9c961;
      stroke-opacity: 1;
      stroke-width: 2.65;
      filter: brightness(1.055) saturate(1.025) drop-shadow(0 0 4px rgba(217, 182, 80, .3));
    }

    .territory:focus-visible {
      outline: none;
      stroke: #fff7df;
      stroke-opacity: 1;
      stroke-width: 2.2;
      filter: brightness(1.06);
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
