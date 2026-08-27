export type TerritoryPoint = {
  x: number;
  y: number;
};

export type TerritoryRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TerritoryShapeProbe = {
  bbox: TerritoryRect;
  boundary: readonly TerritoryPoint[];
  contains: ((point: TerritoryPoint) => boolean) | null;
};

export type TerritoryAnchor = TerritoryPoint;

export type TerritoryGeometry = TerritoryPoint & {
  safeRadius: number;
  bboxWidth: number;
  bboxHeight: number;
};

export type TerritoryMarkerSizing = {
  preferredScale: number;
  preferredMin: number;
  maximum: number;
  safetyFactor?: number;
};

function distanceSquared(a: TerritoryPoint, b: TerritoryPoint) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function distanceSquaredToSegment(
  point: TerritoryPoint,
  segmentStart: TerritoryPoint,
  segmentEnd: TerritoryPoint,
) {
  const segmentLengthSquared = distanceSquared(segmentStart, segmentEnd);
  if (segmentLengthSquared === 0) {
    return distanceSquared(point, segmentStart);
  }

  const projection =
    ((point.x - segmentStart.x) * (segmentEnd.x - segmentStart.x) +
      (point.y - segmentStart.y) * (segmentEnd.y - segmentStart.y)) /
    segmentLengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  const closest = {
    x: segmentStart.x + (segmentEnd.x - segmentStart.x) * t,
    y: segmentStart.y + (segmentEnd.y - segmentStart.y) * t,
  };

  return distanceSquared(point, closest);
}

function distanceToBoundary(
  point: TerritoryPoint,
  boundary: readonly TerritoryPoint[],
) {
  if (boundary.length === 0) return 0;
  if (boundary.length === 1) {
    return Math.sqrt(distanceSquared(point, boundary[0]));
  }

  let nearestSquared = Number.POSITIVE_INFINITY;

  for (let index = 0; index < boundary.length; index += 1) {
    const start = boundary[index];
    const end = boundary[(index + 1) % boundary.length];
    nearestSquared = Math.min(
      nearestSquared,
      distanceSquaredToSegment(point, start, end),
    );
  }

  return Math.sqrt(nearestSquared);
}

function bboxCenter(bbox: TerritoryRect): TerritoryPoint {
  return {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
  };
}

export function calculateTerritoryGeometry(
  probe: TerritoryShapeProbe,
): TerritoryGeometry {
  const { bbox, boundary, contains } = probe;
  const center = bboxCenter(bbox);

  if (bbox.width <= 0 || bbox.height <= 0) {
    return {
      ...center,
      safeRadius: 0,
      bboxWidth: Math.max(0, bbox.width),
      bboxHeight: Math.max(0, bbox.height),
    };
  }

  if (boundary.length === 0) {
    return {
      ...center,
      safeRadius: 0,
      bboxWidth: bbox.width,
      bboxHeight: bbox.height,
    };
  }

  if (!contains) {
    const fallback = boundary[Math.floor(boundary.length / 2)] ?? center;
    return {
      ...fallback,
      safeRadius: 0,
      bboxWidth: bbox.width,
      bboxHeight: bbox.height,
    };
  }

  let bestPoint: TerritoryPoint | null = null;
  let bestClearance = -1;

  const consider = (point: TerritoryPoint) => {
    if (!contains(point)) return;

    const clearance = distanceToBoundary(point, boundary);
    if (clearance > bestClearance) {
      bestPoint = point;
      bestClearance = clearance;
    }
  };

  // Mantém o centro do bounding box como primeiro candidato para formas regulares.
  consider(center);

  const sampleGrid = (divisions: number) => {
    for (let row = 0; row < divisions; row += 1) {
      for (let column = 0; column < divisions; column += 1) {
        consider({
          x: bbox.x + ((column + 0.5) / divisions) * bbox.width,
          y: bbox.y + ((row + 0.5) / divisions) * bbox.height,
        });
      }
    }
  };

  sampleGrid(17);

  if (!bestPoint) {
    sampleGrid(33);
  }

  if (!bestPoint && boundary.length >= 2) {
    const half = Math.floor(boundary.length / 2);
    for (let index = 0; index < half; index += 1) {
      const opposite = boundary[(index + half) % boundary.length];
      consider({
        x: (boundary[index].x + opposite.x) / 2,
        y: (boundary[index].y + opposite.y) / 2,
      });
    }
  }

  const fallback = bestPoint ?? boundary[0] ?? center;

  return {
    ...fallback,
    safeRadius: bestPoint ? Math.max(0, bestClearance) : 0,
    bboxWidth: bbox.width,
    bboxHeight: bbox.height,
  };
}

export function fitTerritoryMarkerSize(
  geometry: TerritoryGeometry,
  sizing: TerritoryMarkerSizing,
) {
  const preferredScale = Math.max(0, sizing.preferredScale);
  const preferredMin = Math.max(0, sizing.preferredMin);
  const maximum = Math.max(0, sizing.maximum);
  const safetyFactor = Math.max(0, Math.min(1, sizing.safetyFactor ?? 0.78));
  const geometricScale = Math.sqrt(
    Math.max(0, geometry.bboxWidth * geometry.bboxHeight),
  );
  const preferred = Math.min(
    maximum,
    Math.max(preferredMin, geometricScale * preferredScale),
  );

  // Um quadrado de lado S cabe em um círculo de raio R quando S <= R * sqrt(2).
  const safeSquare =
    Math.max(0, geometry.safeRadius) * Math.SQRT2 * safetyFactor;

  return Math.max(0, Math.min(preferred, safeSquare, maximum));
}
