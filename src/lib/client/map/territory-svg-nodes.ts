import type { TerritoryMaterial } from "@/src/lib/client/map/territory-material";

export type TerritoryVisualNodes = {
  face: SVGPathElement;
  faceStops: SVGStopElement[];
  sideStops: SVGStopElement[];
  depths: SVGPathElement[];
  deepRim: SVGPathElement | null;
  bevelLight: SVGPathElement | null;
  bevelDark: SVGPathElement | null;
};

function territorySelector(id: number, selector: string) {
  return `${selector}[data-territory-id="${id}"]`;
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
    ).sort((left, right) => {
      const leftLayer = Number(left.dataset.layer?.replace("depth-", "")) || 0;
      const rightLayer = Number(right.dataset.layer?.replace("depth-", "")) || 0;
      return leftLayer - rightLayer;
    });

    result.set(id, {
      face,
      faceStops: faceGradient
        ? Array.from(faceGradient.querySelectorAll<SVGStopElement>("stop"))
        : [],
      sideStops: sideGradient
        ? Array.from(sideGradient.querySelectorAll<SVGStopElement>("stop"))
        : [],
      depths,
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

  return result;
}

export function applyTerritoryMaterial(
  id: number,
  nodes: TerritoryVisualNodes,
  material: TerritoryMaterial,
) {
  nodes.faceStops.forEach((stop, index) => {
    const color = material.face[index];
    if (color) stop.setAttribute("stop-color", color);
  });

  nodes.sideStops.forEach((stop, index) => {
    const color = material.side[index];
    if (color) stop.setAttribute("stop-color", color);
  });

  for (const depth of nodes.depths) {
    const layer = Number(depth.dataset.layer?.replace("depth-", ""));
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

  nodes.deepRim?.setAttribute("stroke", material.rim);
  nodes.bevelDark?.setAttribute("stroke", material.rim);

  nodes.face.style.removeProperty("fill");
  nodes.face.style.removeProperty("fill-opacity");
  nodes.face.setAttribute("fill", `url(#face-grad-${id})`);
  nodes.face.setAttribute("fill-opacity", "1");
}
