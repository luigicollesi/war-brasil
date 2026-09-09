import type { TerritoryVisualNodes } from "@/src/lib/client/map/territory-svg-nodes";

const SVG_NS = "http://www.w3.org/2000/svg";
const RUNTIME_STYLE_ID = "war-territory-runtime-style";
const HIGHLIGHT_EXPANSION_PX = 4;
const HOVER_EXPANSION_PX = 2;
const MIN_SCREEN_SCALE = 1e-6;

const regionBorders: Record<string, { stroke: string; glow: string }> = {
  norte: { stroke: "#55d075", glow: "rgba(85,208,117,.72)" },
  nordeste: { stroke: "#55a8ff", glow: "rgba(85,168,255,.72)" },
  "centro-oeste": { stroke: "#f4c542", glow: "rgba(244,197,66,.72)" },
  sudeste: { stroke: "#ef5555", glow: "rgba(239,85,85,.72)" },
  sul: { stroke: "#f08a35", glow: "rgba(240,138,53,.72)" },
};

const fallbackRegionBorder = {
  stroke: "#e4dcc0",
  glow: "rgba(228,220,192,.55)",
};

const strongExpansionClasses = [
  "is-available",
  "is-target",
  "is-target-selectable",
  "is-selected",
  "is-opening-highlight",
] as const;

const baseTransforms = new WeakMap<SVGGraphicsElement, string | null>();

export type TerritoryVisualState = {
  available: boolean;
  target: boolean;
  targetSelectable: boolean;
  selected: boolean;
  openingHighlight: boolean;
};

export type TerritoryExpansionTransform = {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
};

type TerritoryExpansionInput = {
  x: number;
  y: number;
  width: number;
  height: number;
  screenScaleX: number;
  screenScaleY: number;
  expansionPx: number;
};

export function computeTerritoryExpansionTransform({
  x,
  y,
  width,
  height,
  screenScaleX,
  screenScaleY,
  expansionPx,
}: TerritoryExpansionInput): TerritoryExpansionTransform {
  if (
    expansionPx <= 0 ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 };
  }

  const safeScaleX = Math.max(Math.abs(screenScaleX), MIN_SCREEN_SCALE);
  const safeScaleY = Math.max(Math.abs(screenScaleY), MIN_SCREEN_SCALE);
  const expansionX = expansionPx / safeScaleX;
  const expansionY = expansionPx / safeScaleY;
  const scaleX = (width + expansionX * 2) / width;
  const scaleY = (height + expansionY * 2) / height;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  return {
    scaleX,
    scaleY,
    translateX: centerX * (1 - scaleX),
    translateY: centerY * (1 - scaleY),
  };
}

function visualElements(nodes: TerritoryVisualNodes): SVGGraphicsElement[] {
  return [
    ...nodes.depths,
    nodes.deepRim,
    nodes.bevelDark,
    nodes.bevelLight,
    nodes.face,
  ].filter((node): node is SVGPathElement => node !== null);
}

function rememberBaseTransform(element: SVGGraphicsElement) {
  if (!baseTransforms.has(element)) {
    baseTransforms.set(element, element.getAttribute("transform"));
  }
  return baseTransforms.get(element) ?? null;
}

function restoreBaseTransform(element: SVGGraphicsElement) {
  const baseTransform = rememberBaseTransform(element);
  if (baseTransform === null) {
    element.removeAttribute("transform");
  } else {
    element.setAttribute("transform", baseTransform);
  }
}

function formatTransformNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

function expansionPixels(face: SVGPathElement) {
  if (strongExpansionClasses.some((className) => face.classList.contains(className))) {
    return HIGHLIGHT_EXPANSION_PX;
  }
  if (
    face.classList.contains("is-hovered") ||
    face.classList.contains("is-keyboard-focused")
  ) {
    return HOVER_EXPANSION_PX;
  }
  return 0;
}

export function refreshTerritoryVisualExpansion(nodes: TerritoryVisualNodes) {
  const elements = visualElements(nodes);
  const expansionPx = expansionPixels(nodes.face);

  if (expansionPx <= 0) {
    for (const element of elements) restoreBaseTransform(element);
    return;
  }

  // Measure without the previous runtime transform so repeated hover/state updates
  // never compound the scale and every territory keeps the same pixel expansion.
  restoreBaseTransform(nodes.face);
  const bounds = nodes.face.getBBox();
  const screenMatrix = nodes.face.getScreenCTM();
  if (!screenMatrix || bounds.width <= 0 || bounds.height <= 0) {
    for (const element of elements) restoreBaseTransform(element);
    return;
  }

  const transform = computeTerritoryExpansionTransform({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    screenScaleX: Math.hypot(screenMatrix.a, screenMatrix.b),
    screenScaleY: Math.hypot(screenMatrix.c, screenMatrix.d),
    expansionPx,
  });
  const runtimeTransform = `matrix(${formatTransformNumber(transform.scaleX)} 0 0 ${formatTransformNumber(transform.scaleY)} ${formatTransformNumber(transform.translateX)} ${formatTransformNumber(transform.translateY)})`;

  for (const element of elements) {
    const baseTransform = rememberBaseTransform(element);
    element.setAttribute(
      "transform",
      baseTransform ? `${runtimeTransform} ${baseTransform}` : runtimeTransform,
    );
  }
}

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
      transition: transform .16s ease, filter .14s ease;
    }

    .territory {
      --territory-stroke-width: .9;
      stroke: var(--territory-region-stroke, #e4dcc0);
      stroke-opacity: .44;
      stroke-width: var(--territory-render-stroke-width, var(--territory-stroke-width));
      filter: none;
      transition: transform .16s ease, filter .14s ease, stroke .14s ease, stroke-opacity .14s ease, stroke-width .14s ease;
    }

    /* The asset has legacy :hover rules. Neutralize browser-native hover so
       only the semantic .is-hovered state chosen by the interaction layer can
       change the piece appearance. */
    .territory:hover {
      --territory-stroke-width: .9;
      stroke: var(--territory-region-stroke, #e4dcc0);
      stroke-opacity: .44;
      filter: none;
    }

    .territory.is-available {
      --territory-stroke-width: 1.8;
      stroke: var(--territory-region-stroke, #f2ead2);
      stroke-opacity: .9;
      filter: brightness(1.14) saturate(1.15) drop-shadow(0 0 3.5px var(--territory-region-glow, rgba(217, 182, 80, .32)));
    }

    .territory-depth.is-available {
      filter: brightness(1.055) saturate(1.04);
    }

    .territory.is-target {
      --territory-stroke-width: 1.7;
      stroke: var(--territory-region-stroke, #e8d8aa);
      stroke-opacity: .84;
      filter: brightness(1.11) saturate(1.11) drop-shadow(0 0 3px var(--territory-region-glow, rgba(217, 182, 80, .28)));
    }

    .territory-depth.is-target {
      filter: brightness(1.045) saturate(1.035);
    }

    .territory.is-hovered {
      --territory-stroke-width: 1.8;
      stroke: var(--territory-region-stroke, #fff7df);
      stroke-opacity: .96;
      filter: brightness(1.1) saturate(1.1) drop-shadow(0 0 2.5px var(--territory-region-glow, rgba(217, 182, 80, .28)));
    }

    .territory-depth.is-hovered {
      filter: brightness(1.055) saturate(1.035);
    }

    .territory.is-target-selectable {
      --territory-stroke-width: 2.25;
      stroke: var(--territory-region-stroke, #fff0b8);
      stroke-opacity: 1;
      filter: brightness(1.18) saturate(1.2) drop-shadow(0 0 5.5px var(--territory-region-glow, rgba(217, 182, 80, .5)));
    }

    .territory-depth.is-target-selectable {
      filter: brightness(1.075) saturate(1.055);
    }

    .territory.is-opening-highlight {
      --territory-stroke-width: 2.3;
      stroke: var(--territory-region-stroke, #fff7df);
      stroke-opacity: 1;
      filter: brightness(1.18) saturate(1.19) drop-shadow(0 0 5.5px var(--territory-region-glow, rgba(255, 247, 223, .48)));
    }

    .territory-depth.is-opening-highlight {
      filter: brightness(1.075) saturate(1.055);
    }

    .territory.is-selected {
      --territory-stroke-width: 2.8;
      stroke: var(--territory-region-stroke, #fff2bd);
      stroke-opacity: 1;
      filter: brightness(1.22) saturate(1.24) drop-shadow(0 0 7px var(--territory-region-glow, rgba(217, 182, 80, .62)));
    }

    .territory-depth.is-selected {
      filter: brightness(1.09) saturate(1.065);
    }

    .territory-depth.is-selected.is-hovered {
      filter: brightness(1.105) saturate(1.075);
    }

    .territory.is-selected.is-hovered {
      filter: brightness(1.24) saturate(1.26) drop-shadow(0 0 7.5px var(--territory-region-glow, rgba(217, 182, 80, .68)));
    }

    .territory.is-keyboard-focused {
      outline: none;
      stroke: var(--territory-region-stroke, #fff7df);
      stroke-opacity: 1;
      filter: brightness(1.16) saturate(1.14) drop-shadow(0 0 4px var(--territory-region-glow, rgba(255, 247, 223, .44)));
    }

    .territory.is-selected.is-keyboard-focused {
      filter: brightness(1.24) saturate(1.26) drop-shadow(0 0 7.5px var(--territory-region-glow, rgba(217, 182, 80, .68)));
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

  refreshTerritoryVisualExpansion(nodes);
}

export function applyTerritoryHoverState(
  nodes: TerritoryVisualNodes,
  hovered: boolean,
) {
  nodes.face.classList.toggle("is-hovered", hovered);
  for (const depth of nodes.depths) {
    depth.classList.toggle("is-hovered", hovered);
  }
  refreshTerritoryVisualExpansion(nodes);
}

export function applyTerritoryKeyboardFocusState(
  nodes: TerritoryVisualNodes,
  focused: boolean,
) {
  nodes.face.classList.toggle("is-keyboard-focused", focused);
  refreshTerritoryVisualExpansion(nodes);
}
