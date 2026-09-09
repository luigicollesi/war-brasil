import {
  territoryHighlightPalette,
  type TerritoryHighlightPalette,
  type TerritoryMaterial,
} from "@/src/lib/client/map/territory-material";
import type { PlayerColor } from "@/src/lib/lobby";

const SVG_NS = "http://www.w3.org/2000/svg";
const EXPECTED_TERRITORY_COUNT = 42;
const EXPECTED_FACE_STOPS = 5;
const EXPECTED_SIDE_STOPS = 3;
const EXPECTED_DEPTH_LAYERS = [1, 2, 3, 4] as const;
const MASK_REFERENCE = /^url\(#([^)]+)\)$/;
const HIGHLIGHT_DEFS_ID = "territory-highlight-defs-runtime";
const HIGHLIGHT_GROUP_ID = "territory-highlights-runtime";
const PLAYER_COLORS: readonly PlayerColor[] = [
  "forest",
  "ocean",
  "sun",
  "ruby",
  "violet",
  "orange",
];

export type TerritoryVisualNodes = {
  face: SVGPathElement;
  highlight: SVGPathElement;
  faceStops: SVGStopElement[];
  sideStops: SVGStopElement[];
  depths: SVGPathElement[];
  interactiveSurfaces: SVGPathElement[];
  deepRim: SVGPathElement | null;
  bevelLight: SVGPathElement | null;
  bevelDark: SVGPathElement | null;
};

function territorySelector(id: number, selector: string) {
  return `${selector}[data-territory-id="${id}"]`;
}

function depthLayer(path: SVGPathElement) {
  return Number(path.dataset.layer?.replace("depth-", "")) || 0;
}

function maskId(path: SVGPathElement) {
  const reference = path.getAttribute("mask")?.trim();
  return reference ? MASK_REFERENCE.exec(reference)?.[1] ?? null : null;
}

function highlightGradientId(color: PlayerColor) {
  return `territory-highlight-${color}`;
}

function applyFaceStops(
  nodes: TerritoryVisualNodes,
  colors: readonly [string, string, string, string, string],
) {
  nodes.faceStops.forEach((stop, index) => {
    const color = colors[index];
    if (color) stop.setAttribute("stop-color", color);
  });
}

function applyBaseFaceMaterial(
  nodes: TerritoryVisualNodes,
  material: TerritoryMaterial,
) {
  applyFaceStops(nodes, material.face);
  nodes.deepRim?.setAttribute("stroke", material.rim);
  nodes.bevelDark?.setAttribute("stroke", material.rim);
}

function appendHighlightStop(
  document: Document,
  gradient: SVGRadialGradientElement,
  offset: string,
  color: string,
  opacity: string,
) {
  const stop = document.createElementNS(SVG_NS, "stop");
  stop.setAttribute("offset", offset);
  stop.setAttribute("stop-color", color);
  stop.setAttribute("stop-opacity", opacity);
  gradient.appendChild(stop);
}

function appendHighlightGradient(
  document: Document,
  defs: SVGDefsElement,
  color: PlayerColor,
  palette: TerritoryHighlightPalette,
) {
  const gradient = document.createElementNS(SVG_NS, "radialGradient");
  gradient.id = highlightGradientId(color);
  gradient.setAttribute("gradientUnits", "objectBoundingBox");
  gradient.setAttribute("cx", ".24");
  gradient.setAttribute("cy", ".18");
  gradient.setAttribute("fx", ".31");
  gradient.setAttribute("fy", ".20");
  gradient.setAttribute("r", ".88");
  gradient.setAttribute(
    "gradientTransform",
    "translate(.5 .5) rotate(-22) scale(1.35 .68) translate(-.5 -.5)",
  );

  appendHighlightStop(document, gradient, "0%", palette.soft, "0");
  appendHighlightStop(document, gradient, "22%", palette.soft, ".02");
  appendHighlightStop(document, gradient, "38%", palette.soft, ".10");
  appendHighlightStop(document, gradient, "49%", palette.peak, ".70");
  appendHighlightStop(document, gradient, "58%", palette.peak, ".32");
  appendHighlightStop(document, gradient, "71%", palette.soft, ".08");
  appendHighlightStop(document, gradient, "88%", palette.soft, "0");
  appendHighlightStop(document, gradient, "100%", palette.soft, "0");
  defs.appendChild(gradient);
}

function ensureTerritoryHighlightGradients(document: Document) {
  if (document.getElementById(HIGHLIGHT_DEFS_ID)) return;

  const defs = document.createElementNS(SVG_NS, "defs");
  defs.id = HIGHLIGHT_DEFS_ID;
  for (const color of PLAYER_COLORS) {
    appendHighlightGradient(
      document,
      defs,
      color,
      territoryHighlightPalette(color),
    );
  }
  document.documentElement.prepend(defs);
}

function ensureHighlightGroup(
  document: Document,
  faces: readonly SVGPathElement[],
) {
  const existing = document.getElementById(HIGHLIGHT_GROUP_ID);
  if (existing?.tagName.toLowerCase() === "g") return existing as SVGGElement;

  const group = document.createElementNS(SVG_NS, "g");
  group.id = HIGHLIGHT_GROUP_ID;
  group.setAttribute("aria-hidden", "true");
  group.style.pointerEvents = "none";

  const faceRoot = faces[0]?.parentElement;
  if (!faceRoot) {
    throw new Error("Invalid 2.5D map visual contract: territory face root is missing");
  }
  faceRoot.appendChild(group);
  return group;
}

function ensureTerritoryHighlightOverlay(
  document: Document,
  group: SVGGElement,
  face: SVGPathElement,
  id: number,
) {
  const selector = `path.territory-highlight[data-territory-id="${id}"]`;
  const existing = group.querySelector<SVGPathElement>(selector);
  if (existing) return existing;

  const highlight = document.createElementNS(SVG_NS, "path");
  highlight.classList.add("territory-highlight");
  highlight.dataset.territoryId = String(id);
  highlight.setAttribute("d", face.getAttribute("d") ?? "");
  highlight.setAttribute("fill", "none");
  highlight.setAttribute("opacity", "0");
  highlight.setAttribute("pointer-events", "none");

  for (const attribute of ["transform", "fill-rule", "clip-rule"] as const) {
    const value = face.getAttribute(attribute);
    if (value) highlight.setAttribute(attribute, value);
  }

  group.appendChild(highlight);
  return highlight;
}

function applyHighlightPalette(
  nodes: TerritoryVisualNodes,
  color: PlayerColor | null,
) {
  if (!color) {
    nodes.highlight.setAttribute("fill", "none");
    nodes.highlight.dataset.playerColor = "";
    nodes.face.style.removeProperty("--territory-highlight-edge");
    nodes.face.style.removeProperty("--territory-highlight-edge-strong");
    return;
  }

  const palette = territoryHighlightPalette(color);
  nodes.highlight.setAttribute("fill", `url(#${highlightGradientId(color)})`);
  nodes.highlight.dataset.playerColor = color;
  nodes.face.style.setProperty("--territory-highlight-edge", palette.edge);
  nodes.face.style.setProperty(
    "--territory-highlight-edge-strong",
    palette.edgeStrong,
  );
}

function validateMaskContract(
  document: Document,
  path: SVGPathElement,
  expectedMaskId: string,
  label: string,
  issues: string[],
) {
  const actualMaskId = maskId(path);
  if (actualMaskId !== expectedMaskId) {
    issues.push(`${label}: expected mask ${expectedMaskId}, received ${actualMaskId ?? "none"}`);
    return;
  }

  const mask = document.getElementById(expectedMaskId);
  const geometry = mask?.querySelectorAll<SVGGeometryElement>("path") ?? [];
  if (!mask || geometry.length !== 1) {
    issues.push(`${label}: mask ${expectedMaskId} must contain exactly one path`);
    return;
  }

  const maskPath = geometry[0];
  const fill = maskPath.getAttribute("fill")?.toLowerCase();
  const stroke = maskPath.getAttribute("stroke")?.toLowerCase();
  const strokeWidth = Number(maskPath.getAttribute("stroke-width"));
  if (fill !== "#fff" || stroke !== "#000" || !Number.isFinite(strokeWidth) || strokeWidth <= 0) {
    issues.push(
      `${label}: mask ${expectedMaskId} must use white fill and a positive black erosion stroke`,
    );
  }
}

export function validateTerritoryVisualRegistry(
  document: Document,
  registry: ReadonlyMap<number, TerritoryVisualNodes>,
): string[] {
  const issues: string[] = [];
  const svg = document.documentElement;

  if (svg.getAttribute("viewBox") !== "0 0 1254 1254") {
    issues.push(`map viewBox must be 0 0 1254 1254`);
  }
  if (svg.getAttribute("data-layout") !== "2.5d-premium-v2") {
    issues.push(`map data-layout must be 2.5d-premium-v2`);
  }
  if (!document.getElementById("board-v2")) {
    issues.push(`map interaction root #board-v2 is missing`);
  }
  if (registry.size !== EXPECTED_TERRITORY_COUNT) {
    issues.push(
      `expected ${EXPECTED_TERRITORY_COUNT} territories, received ${registry.size}`,
    );
  }

  for (let id = 1; id <= EXPECTED_TERRITORY_COUNT; id += 1) {
    const nodes = registry.get(id);
    if (!nodes) {
      issues.push(`territory ${id}: visual registry entry is missing`);
      continue;
    }

    if (Number(nodes.face.dataset.id) !== id || Number(nodes.face.dataset.territoryId) !== id) {
      issues.push(`territory ${id}: face data identifiers are inconsistent`);
    }
    if (Number(nodes.highlight.dataset.territoryId) !== id) {
      issues.push(`territory ${id}: highlight overlay data identifier is inconsistent`);
    }
    if (nodes.faceStops.length !== EXPECTED_FACE_STOPS) {
      issues.push(
        `territory ${id}: expected ${EXPECTED_FACE_STOPS} face gradient stops, received ${nodes.faceStops.length}`,
      );
    }
    if (nodes.sideStops.length !== EXPECTED_SIDE_STOPS) {
      issues.push(
        `territory ${id}: expected ${EXPECTED_SIDE_STOPS} side gradient stops, received ${nodes.sideStops.length}`,
      );
    }

    const layers = nodes.depths.map(depthLayer);
    if (
      layers.length !== EXPECTED_DEPTH_LAYERS.length ||
      layers.some((layer, index) => layer !== EXPECTED_DEPTH_LAYERS[index])
    ) {
      issues.push(
        `territory ${id}: expected depth layers 1,2,3,4, received ${layers.join(",") || "none"}`,
      );
    }

    validateMaskContract(
      document,
      nodes.face,
      `face-mask-${id}`,
      `territory ${id} face`,
      issues,
    );
    for (const depth of nodes.depths) {
      const layer = depthLayer(depth);
      validateMaskContract(
        document,
        depth,
        `body-mask-${id}-${layer}`,
        `territory ${id} depth ${layer}`,
        issues,
      );
    }
  }

  return issues;
}

export function collectTerritoryVisualNodes(
  document: Document,
  faces: readonly SVGPathElement[],
): Map<number, TerritoryVisualNodes> {
  const result = new Map<number, TerritoryVisualNodes>();
  ensureTerritoryHighlightGradients(document);
  const highlightGroup = ensureHighlightGroup(document, faces);

  for (const face of faces) {
    const id = Number(face.dataset.id);
    if (!Number.isInteger(id)) continue;

    const faceGradient = document.querySelector<SVGLinearGradientElement>(
      `#face-grad-${id}`,
    );
    const sideGradient = document.querySelector<SVGLinearGradientElement>(
      `#side-grad-${id}`,
    );
    const depths = Array.from(
      document.querySelectorAll<SVGPathElement>(
        territorySelector(id, "path.territory-depth"),
      ),
    ).sort((left, right) => depthLayer(left) - depthLayer(right));

    result.set(id, {
      face,
      highlight: ensureTerritoryHighlightOverlay(
        document,
        highlightGroup,
        face,
        id,
      ),
      faceStops: faceGradient
        ? Array.from(faceGradient.querySelectorAll<SVGStopElement>("stop"))
        : [],
      sideStops: sideGradient
        ? Array.from(sideGradient.querySelectorAll<SVGStopElement>("stop"))
        : [],
      depths,
      interactiveSurfaces: [face, ...depths],
      deepRim: document.querySelector<SVGPathElement>(
        territorySelector(id, "path.territory-deep-rim"),
      ),
      bevelLight: document.querySelector<SVGPathElement>(
        territorySelector(id, "path.territory-bevel-light"),
      ),
      bevelDark: document.querySelector<SVGPathElement>(
        territorySelector(id, "path.territory-bevel-dark"),
      ),
    });
  }

  if (process.env.NODE_ENV !== "production") {
    const issues = validateTerritoryVisualRegistry(document, result);
    if (issues.length) {
      throw new Error(`Invalid 2.5D map visual contract:\n${issues.join("\n")}`);
    }
  }

  return result;
}

export function applyTerritoryMaterial(
  id: number,
  nodes: TerritoryVisualNodes,
  material: TerritoryMaterial,
) {
  nodes.face.dataset.playerColor = material.playerColor ?? "";
  applyBaseFaceMaterial(nodes, material);
  applyHighlightPalette(nodes, material.playerColor);

  nodes.sideStops.forEach((stop, index) => {
    const color = material.side[index];
    if (color) stop.setAttribute("stop-color", color);
  });

  for (const depth of nodes.depths) {
    const layer = depthLayer(depth);
    if (layer === 1) {
      depth.setAttribute("fill", `url(#side-grad-${id})`);
    } else if (layer === 2) {
      depth.setAttribute("fill", material.side[0]);
    } else if (layer === 3) {
      depth.setAttribute("fill", material.side[1]);
    } else if (layer === 4) {
      depth.setAttribute("fill", material.side[2]);
    }
  }

  nodes.face.style.removeProperty("fill");
  nodes.face.style.removeProperty("fill-opacity");
  nodes.face.setAttribute("fill", `url(#face-grad-${id})`);
  nodes.face.setAttribute("fill-opacity", "1");
}
