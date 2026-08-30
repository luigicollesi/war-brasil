export const MAP_WORLD_SIZE = 1254;
export const MAP_MIN_SCALE = 1;
export const MAP_MAX_SCALE = 3;
export const MAP_PAN_THRESHOLD = 6;
export const MAP_VIEWPORT_EVENT = "game-map-viewport-change";
export const MAP_SELECTION_PADDING_RATIO = 0.2;
export const MAP_AUTO_FOCUS_DURATION_MS = 240;
export const MAP_STROKE_ZOOM_EXPONENT = 1.25;
export const MAP_MIN_TERRITORY_STROKE = 0.75;

export type MapViewportTransform = {
  scale: number;
  panX: number;
  panY: number;
};

export type MapViewportPoint = {
  x: number;
  y: number;
};

export type MapWorldBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DEFAULT_MAP_VIEWPORT: MapViewportTransform = {
  scale: MAP_MIN_SCALE,
  panX: 0,
  panY: 0,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function validMapBounds(bounds: MapWorldBounds) {
  return (
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width >= 0 &&
    bounds.height >= 0
  );
}

export function unionMapBounds(
  bounds: readonly MapWorldBounds[],
): MapWorldBounds | null {
  const validBounds = bounds.filter(validMapBounds);
  if (!validBounds.length) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const box of validBounds) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function clampMapViewport(
  viewport: MapViewportTransform,
  width: number,
  height: number,
): MapViewportTransform {
  const scale = clamp(viewport.scale, MAP_MIN_SCALE, MAP_MAX_SCALE);
  if (scale <= MAP_MIN_SCALE + 0.001 || width <= 0 || height <= 0) {
    return { ...DEFAULT_MAP_VIEWPORT };
  }

  return {
    scale,
    panX: clamp(viewport.panX, width * (1 - scale), 0),
    panY: clamp(viewport.panY, height * (1 - scale), 0),
  };
}

export function fitMapViewportToBounds({
  bounds,
  width,
  height,
  paddingRatio = MAP_SELECTION_PADDING_RATIO,
  worldSize = MAP_WORLD_SIZE,
}: {
  bounds: MapWorldBounds;
  width: number;
  height: number;
  paddingRatio?: number;
  worldSize?: number;
}): MapViewportTransform {
  if (
    !validMapBounds(bounds) ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    width <= 0 ||
    height <= 0 ||
    worldSize <= 0
  ) {
    return { ...DEFAULT_MAP_VIEWPORT };
  }

  const safePaddingRatio = Math.max(0, paddingRatio);
  const paddedWidth = bounds.width * (1 + safePaddingRatio * 2);
  const paddedHeight = bounds.height * (1 + safePaddingRatio * 2);
  const scale = Math.min(worldSize / paddedWidth, worldSize / paddedHeight);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return clampMapViewport(
    {
      scale,
      panX: width / 2 - (centerX / worldSize) * width * scale,
      panY: height / 2 - (centerY / worldSize) * height * scale,
    },
    width,
    height,
  );
}

export function mapStrokeWidthForScale(baseWidth: number, scale: number) {
  if (!Number.isFinite(baseWidth) || baseWidth <= 0) return 0;

  const safeScale = Math.max(MAP_MIN_SCALE, scale);
  const minimum = Math.min(baseWidth, MAP_MIN_TERRITORY_STROKE);
  return Math.max(
    minimum,
    baseWidth / Math.pow(safeScale, MAP_STROKE_ZOOM_EXPONENT),
  );
}

export function easeOutCubic(progress: number) {
  const normalized = clamp(progress, 0, 1);
  return 1 - Math.pow(1 - normalized, 3);
}

export function interpolateMapViewport(
  from: MapViewportTransform,
  to: MapViewportTransform,
  progress: number,
): MapViewportTransform {
  const normalized = clamp(progress, 0, 1);
  return {
    scale: from.scale + (to.scale - from.scale) * normalized,
    panX: from.panX + (to.panX - from.panX) * normalized,
    panY: from.panY + (to.panY - from.panY) * normalized,
  };
}

export function zoomMapViewportAtPoint({
  viewport,
  startFocus,
  currentFocus,
  nextScale,
  width,
  height,
}: {
  viewport: MapViewportTransform;
  startFocus: MapViewportPoint;
  currentFocus: MapViewportPoint;
  nextScale: number;
  width: number;
  height: number;
}) {
  const safeStartScale = Math.max(MAP_MIN_SCALE, viewport.scale);
  const worldX = (startFocus.x - viewport.panX) / safeStartScale;
  const worldY = (startFocus.y - viewport.panY) / safeStartScale;

  return clampMapViewport(
    {
      scale: nextScale,
      panX: currentFocus.x - worldX * nextScale,
      panY: currentFocus.y - worldY * nextScale,
    },
    width,
    height,
  );
}

export function mapViewportToViewBox(
  viewport: MapViewportTransform,
  width: number,
  height: number,
  worldSize = MAP_WORLD_SIZE,
) {
  const normalized = clampMapViewport(viewport, width, height);
  const viewWidth = worldSize / normalized.scale;
  const viewHeight = worldSize / normalized.scale;
  const x = width > 0
    ? (-normalized.panX / (width * normalized.scale)) * worldSize
    : 0;
  const y = height > 0
    ? (-normalized.panY / (height * normalized.scale)) * worldSize
    : 0;

  return {
    x,
    y,
    width: viewWidth,
    height: viewHeight,
    value: `${x} ${y} ${viewWidth} ${viewHeight}`,
  };
}

export function projectMapPoint(
  point: MapViewportPoint,
  width: number,
  height: number,
  viewport: MapViewportTransform,
  worldSize = MAP_WORLD_SIZE,
): MapViewportPoint {
  return {
    x: viewport.panX + viewport.scale * ((point.x / worldSize) * width),
    y: viewport.panY + viewport.scale * ((point.y / worldSize) * height),
  };
}
