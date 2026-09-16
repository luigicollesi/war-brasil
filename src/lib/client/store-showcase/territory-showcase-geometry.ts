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

function applyCenteredSquareUvs(
  geometries: ReadonlyArray<ExtrudeGeometry>,
  bounds: Box3,
) {
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const dominantExtent = Math.max(size.x, size.y);
  const originX = center.x - dominantExtent / 2;
  const originY = center.y - dominantExtent / 2;

  for (const geometry of geometries) {
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    if (!position || !uv) continue;

    for (let index = 0; index < position.count; index += 1) {
      uv.setXY(
        index,
        (position.getX(index) - originX) / dominantExtent,
        (position.getY(index) - originY) / dominantExtent,
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
  applyCenteredSquareUvs(geometries, normalizedBounds);

  return {
    geometries,
    sourceAspectRatio: sourceSize.x / sourceSize.y,
    normalizedSize,
  };
}
