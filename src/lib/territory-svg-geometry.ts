import {
  calculateTerritoryGeometry,
  type TerritoryGeometry,
  type TerritoryPoint,
  type TerritoryRect,
} from "./territory-geometry";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readBBox(pathElement: SVGPathElement): TerritoryRect {
  try {
    const bbox = pathElement.getBBox();
    return {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    };
  } catch {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
}

function sampleBoundary(
  pathElement: SVGPathElement,
  bbox: TerritoryRect,
): TerritoryPoint[] {
  let totalLength = 0;

  try {
    totalLength = pathElement.getTotalLength();
  } catch {
    return [];
  }

  if (!Number.isFinite(totalLength) || totalLength <= 0) return [];

  const minDimension = Math.max(1, Math.min(bbox.width, bbox.height));
  const targetSpacing = Math.max(2, minDimension / 24);
  const sampleCount = clamp(
    Math.ceil(totalLength / targetSpacing),
    96,
    512,
  );

  const boundary: TerritoryPoint[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    try {
      const point = pathElement.getPointAtLength(
        (totalLength * index) / sampleCount,
      );
      boundary.push({ x: point.x, y: point.y });
    } catch {
      break;
    }
  }

  return boundary;
}

export function territoryGeometryFromPath(
  pathElement: SVGPathElement,
): TerritoryGeometry {
  const bbox = readBBox(pathElement);
  const boundary = sampleBoundary(pathElement, bbox);
  const contains =
    typeof pathElement.isPointInFill === "function"
      ? (point: TerritoryPoint) => {
          try {
            return pathElement.isPointInFill(point);
          } catch {
            return false;
          }
        }
      : null;

  return calculateTerritoryGeometry({ bbox, boundary, contains });
}
