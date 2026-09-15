import type { TerritoryVisualNodes } from "@/src/lib/client/map/territory-svg-nodes";

const SVG_NS = "http://www.w3.org/2000/svg";
const SKIN_PATTERN_SIZE = 192;
const SKIN_OVERLAY_OPACITY_PROPERTY = "--territory-skin-opacity";

const SKIN_OVERLAY_OPACITY_BY_SURFACE_STATE = {
  normal: "0.52",
  hover: "0.32",
  highlighted: "0.18",
  "highlighted-hover": "0.12",
} as const;

type TerritorySkinSurfaceState = keyof typeof SKIN_OVERLAY_OPACITY_BY_SURFACE_STATE;

const patternIdsByDocument = new WeakMap<Document, Map<string, string>>();
const failedAssetsByDocument = new WeakMap<Document, Set<string>>();

function patternRegistry(document: Document): Map<string, string> {
  const existing = patternIdsByDocument.get(document);
  if (existing) return existing;
  const created = new Map<string, string>();
  patternIdsByDocument.set(document, created);
  return created;
}

function failedAssetRegistry(document: Document): Set<string> {
  const existing = failedAssetsByDocument.get(document);
  if (existing) return existing;
  const created = new Set<string>();
  failedAssetsByDocument.set(document, created);
  return created;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function ensureDefs(document: Document) {
  const existing = document.documentElement.querySelector<SVGDefsElement>("defs");
  if (existing) return existing;

  const defs = document.createElementNS(SVG_NS, "defs");
  document.documentElement.insertBefore(defs, document.documentElement.firstChild);
  return defs;
}

function removeTerritorySkinOverlaysForAsset(
  document: Document,
  assetRef: string,
) {
  const overlays = document.querySelectorAll<SVGPathElement>(
    "path.territory-skin-overlay",
  );
  for (const overlay of overlays) {
    if (overlay.dataset.territorySkinAsset === assetRef) overlay.remove();
  }
}

export function syncTerritorySkinSurfaceState(
  nodes: TerritoryVisualNodes,
  surfaceState: TerritorySkinSurfaceState,
) {
  const opacity = SKIN_OVERLAY_OPACITY_BY_SURFACE_STATE[surfaceState];
  nodes.face.parentElement?.style.setProperty(
    SKIN_OVERLAY_OPACITY_PROPERTY,
    opacity,
  );
}

export function ensureTerritorySkinPattern(
  document: Document,
  assetRef: string,
): string | null {
  const failedAssets = failedAssetRegistry(document);
  if (failedAssets.has(assetRef)) return null;

  const registry = patternRegistry(document);
  const knownId = registry.get(assetRef);
  if (knownId && document.getElementById(knownId)) return knownId;

  const id = `territory-skin-pattern-${stableHash(assetRef)}`;
  const existing = document.getElementById(id);
  if (existing) {
    registry.set(assetRef, id);
    return id;
  }

  const pattern = document.createElementNS(SVG_NS, "pattern");
  pattern.id = id;
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  pattern.setAttribute("width", String(SKIN_PATTERN_SIZE));
  pattern.setAttribute("height", String(SKIN_PATTERN_SIZE));
  pattern.dataset.territorySkinAsset = assetRef;

  const image = document.createElementNS(SVG_NS, "image");
  image.setAttribute("href", assetRef);
  image.setAttribute("width", String(SKIN_PATTERN_SIZE));
  image.setAttribute("height", String(SKIN_PATTERN_SIZE));
  image.setAttribute("preserveAspectRatio", "xMidYMid slice");
  image.setAttribute("pointer-events", "none");

  image.addEventListener(
    "error",
    () => {
      failedAssets.add(assetRef);
      removeTerritorySkinOverlaysForAsset(document, assetRef);
      registry.delete(assetRef);
      pattern.remove();
    },
    { once: true },
  );

  pattern.appendChild(image);
  ensureDefs(document).appendChild(pattern);
  registry.set(assetRef, id);
  return id;
}

function overlaySelector(id: number) {
  return `path.territory-skin-overlay[data-territory-id="${id}"]`;
}

function removeTerritorySkinOverlay(id: number, document: Document) {
  document.querySelector<SVGPathElement>(overlaySelector(id))?.remove();
}

export function applyTerritorySkinOverlay(
  id: number,
  nodes: TerritoryVisualNodes,
  assetRef: string | null,
) {
  const document = nodes.face.ownerDocument;
  if (!assetRef) {
    removeTerritorySkinOverlay(id, document);
    return;
  }

  const patternId = ensureTerritorySkinPattern(document, assetRef);
  if (!patternId) {
    removeTerritorySkinOverlay(id, document);
    return;
  }

  let overlay = document.querySelector<SVGPathElement>(overlaySelector(id));
  if (!overlay) {
    overlay = document.createElementNS(SVG_NS, "path");
    overlay.classList.add("territory-skin-overlay");
    overlay.dataset.territoryId = String(id);
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("pointer-events", "none");
    overlay.style.pointerEvents = "none";
    overlay.style.opacity = `var(${SKIN_OVERLAY_OPACITY_PROPERTY}, ${SKIN_OVERLAY_OPACITY_BY_SURFACE_STATE.normal})`;
    // The texture contributes luminosity only. PlayerColor and the semantic
    // surface fill remain the authoritative hue/saturation channels beneath it.
    overlay.style.mixBlendMode = "luminosity";
    nodes.face.insertAdjacentElement("afterend", overlay);
  }

  for (const attribute of ["d", "transform", "mask", "clip-path", "fill-rule"] as const) {
    const value = nodes.face.getAttribute(attribute);
    if (value === null) overlay.removeAttribute(attribute);
    else overlay.setAttribute(attribute, value);
  }

  overlay.dataset.territorySkinAsset = assetRef;
  overlay.setAttribute("fill", `url(#${patternId})`);
  overlay.setAttribute("stroke", "none");
}
