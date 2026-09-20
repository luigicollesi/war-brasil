import {
  Box3,
  ExtrudeGeometry,
  Vector3,
  type Shape,
} from "three";
import {
  SHOWCASE_TERRITORY_SOURCE_DEPTH,
  SHOWCASE_TERRITORY_TARGET_SIZE,
} from "./territory-showcase-config";

const TERRITORY_SKIN_PATTERN_SIZE = 192;

export type TerritoryShowcaseGeometry = Readonly<{
  geometries: ReadonlyArray<ExtrudeGeometry>;
  sourceAspectRatio: number;
  normalizedSize: Vector3;
}>;

function collectiveBounds(geometries: ReadonlyArray<ExtrudeGeometry>) {
  const bounds = new Box3();

  for (const geometry of geometries) {
    geometry.computeBoundingBox();
    if (geometry.boundingBox) bounds.union(geometry.boundingBox);
  }

  return bounds;
}

function applyCanonicalPatternUvs(geometries: ReadonlyArray<ExtrudeGeometry>) {
  for (const geometry of geometries) {
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    if (!position || !uv) continue;

    for (let index = 0; index < position.count; index += 1) {
      uv.setXY(
        index,
        position.getX(index) / TERRITORY_SKIN_PATTERN_SIZE,
        position.getY(index) / TERRITORY_SKIN_PATTERN_SIZE,
      );
    }
    uv.needsUpdate = true;
  }
}

export function createTerritoryShowcaseGeometry(
  shapes: ReadonlyArray<Shape>,
): TerritoryShowcaseGeometry {
  if (shapes.length === 0) {
    throw new Error("Canonical showcase territory must contain at least one SVG shape.");
  }

  const geometries = shapes.map(
    (shape) =>
      new ExtrudeGeometry(shape, {
        depth: SHOWCASE_TERRITORY_SOURCE_DEPTH,
        bevelEnabled: true,
        bevelThickness: 1.8,
        bevelSize: 1.25,
        bevelSegments: 2,
        curveSegments: 6,
      }),
  );

  const bounds = collectiveBounds(geometries);
  const sourceSize = bounds.getSize(new Vector3());
  const sourceCenter = bounds.getCenter(new Vector3());
  const dominantExtent = Math.max(sourceSize.x, sourceSize.y);

  if (!Number.isFinite(dominantExtent) || dominantExtent <= 0) {
    for (const geometry of geometries) geometry.dispose();
    throw new Error("Canonical showcase territory has invalid SVG bounds.");
  }

  // Match the board's SVG patternUnits="userSpaceOnUse" mapping before the
  // showcase geometry is centered/scaled. UV values intentionally exceed 1 so
  // the 192x192 skin repeats in the same canonical map coordinate space.
  applyCanonicalPatternUvs(geometries);

  const scale = SHOWCASE_TERRITORY_TARGET_SIZE / dominantExtent;

  for (const geometry of geometries) {
    geometry.translate(-sourceCenter.x, -sourceCenter.y, -sourceCenter.z);
    // SVG uses a downward-positive Y axis; flip Y so the canonical silhouette is upright in Three.js.
    geometry.scale(scale, -scale, scale);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
  }

  const normalizedBounds = collectiveBounds(geometries);
  const normalizedSize = normalizedBounds.getSize(new Vector3());

  return {
    geometries,
    sourceAspectRatio: sourceSize.x / sourceSize.y,
    normalizedSize,
  };
}
