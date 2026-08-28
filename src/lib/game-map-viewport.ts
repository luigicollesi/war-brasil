export const MAP_WORLD_SIZE = 1254;
export const MAP_MIN_SCALE = 1;
export const MAP_MAX_SCALE = 3;
export const MAP_PAN_THRESHOLD = 6;
export const MAP_VIEWPORT_EVENT = "game-map-viewport-change";

export type MapViewportTransform = {
  scale: number;
  panX: number;
  panY: number;
};

export type MapViewportPoint = {
  x: number;
  y: number;
};

export const DEFAULT_MAP_VIEWPORT: MapViewportTransform = {
  scale: MAP_MIN_SCALE,
  panX: 0,
  panY: 0,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
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
