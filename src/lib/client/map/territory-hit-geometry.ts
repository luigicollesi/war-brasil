import type { TerritoryVisualNodes } from "@/src/lib/client/map/territory-svg-nodes";

const LEGACY_HIT_LAYER_SELECTOR = '[data-map-hit-layer="true"]';

export type TerritoryHitNodes = {
  face: SVGPathElement;
  depths: SVGPathElement[];
};

function disableDecorativePointerEvents(nodes: TerritoryVisualNodes) {
  for (const depth of nodes.depths) {
    depth.style.pointerEvents = "none";
    depth.style.cursor = "default";
    delete depth.dataset.territoryHit;
  }

  for (const decoration of [nodes.deepRim, nodes.bevelLight, nodes.bevelDark]) {
    if (!decoration) continue;
    decoration.style.pointerEvents = "none";
  }
}

/**
 * Configures the painted top face of each territory as its own hit target.
 *
 * The old implementation generated an additional SVG layer by parsing and
 * insetting every face/depth polygon. That duplicated geometry and DOM nodes
 * solely for pointer interaction. The visible face already has the exact
 * interaction shape we need, so keeping interaction on it avoids that work
 * while preserving the existing delegated-event contract.
 */
export function buildTerritoryHitLayer(
  _document: Document,
  boardRoot: Element,
  territories: ReadonlyMap<number, TerritoryVisualNodes>,
): Map<number, TerritoryHitNodes> {
  boardRoot.querySelector(LEGACY_HIT_LAYER_SELECTOR)?.remove();

  const result = new Map<number, TerritoryHitNodes>();

  for (const [id, nodes] of territories) {
    const face = nodes.face;

    face.dataset.territoryHit = "true";
    face.dataset.territoryId = String(id);
    face.dataset.territorySurface = "face";
    face.style.pointerEvents = "fill";
    face.style.cursor = "pointer";
    face.setAttribute("tabindex", "0");
    face.setAttribute("role", "button");
    face.setAttribute("aria-label", face.dataset.name ?? `Território ${id}`);
    face.removeAttribute("aria-hidden");

    disableDecorativePointerEvents(nodes);
    result.set(id, { face, depths: [] });
  }

  return result;
}
