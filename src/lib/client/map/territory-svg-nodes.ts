import {
  selectedTerritoryMaterial,
  territoryMaterial,
  type TerritoryMaterial,
  type TerritorySelectionMaterial,
} from "@/src/lib/client/map/territory-material";
import type { PlayerColor } from "@/src/lib/lobby";

const EXPECTED_TERRITORY_COUNT = 42;
const EXPECTED_FACE_STOPS = 5;
const EXPECTED_SIDE_STOPS = 3;
const EXPECTED_DEPTH_LAYERS = [1, 2, 3, 4] as const;
const MASK_REFERENCE = /^url\(#([^)]+)\)$/;

export type TerritoryVisualNodes = {
  face: SVGPathElement;
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
  nodes.face.style.removeProperty("--territory-selection-stroke");
}

function applySelectedFaceMaterial(
  nodes: TerritoryVisualNodes,
  material: TerritorySelectionMaterial,
) {
  applyFaceStops(nodes, material.face);
  nodes.deepRim?.setAttribute("stroke", material.edgeDark);
  nodes.bevelDark?.setAttribute("stroke", material.edgeDark);
  nodes.face.style.setProperty("--territory-selection-stroke", material.edgeLight);
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

export function applyTerritorySelectionState(
  nodes: TerritoryVisualNodes,
  selected: boolean,
) {
  const color = nodes.face.dataset.playerColor as PlayerColor | undefined;
  if (!color) return;

  if (selected) {
    applySelectedFaceMaterial(nodes, selectedTerritoryMaterial(color));
    return;
  }

  applyBaseFaceMaterial(nodes, territoryMaterial(color));
}

export function applyTerritoryMaterial(
  id: number,
  nodes: TerritoryVisualNodes,
  material: TerritoryMaterial,
) {
  nodes.face.dataset.playerColor = material.playerColor ?? "";
  applyBaseFaceMaterial(nodes, material);

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

  if (material.playerColor && nodes.face.classList.contains("is-selected")) {
    applySelectedFaceMaterial(
      nodes,
      selectedTerritoryMaterial(material.playerColor),
    );
  }
}
