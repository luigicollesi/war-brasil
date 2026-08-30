import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MAP_VIEWPORT,
  MAP_AUTO_FOCUS_DURATION_MS,
  MAP_MAX_SCALE,
  clampMapViewport,
  easeOutCubic,
  fitMapViewportToBounds,
  interpolateMapViewport,
  mapStrokeWidthForScale,
  mapViewportToViewBox,
  projectMapPoint,
  unionMapBounds,
  zoomMapViewportAtPoint,
} from "../.test-build/game-map-viewport.js";

test("map viewport never zooms out past the current board size", () => {
  assert.deepEqual(
    clampMapViewport({ scale: 0.4, panX: 120, panY: -50 }, 390, 390),
    DEFAULT_MAP_VIEWPORT,
  );
});

test("map viewport clamps zoom and pan to keep the board covering its surface", () => {
  const viewport = clampMapViewport(
    { scale: 9, panX: -9999, panY: 9999 },
    400,
    400,
  );

  assert.equal(viewport.scale, MAP_MAX_SCALE);
  assert.equal(viewport.panX, -800);
  assert.equal(viewport.panY, 0);
});

test("pinch zoom keeps the world point under the fingers stable", () => {
  const width = 400;
  const height = 400;
  const focus = { x: 120, y: 260 };
  const viewport = zoomMapViewportAtPoint({
    viewport: DEFAULT_MAP_VIEWPORT,
    startFocus: focus,
    currentFocus: focus,
    nextScale: 2,
    width,
    height,
  });

  const worldPoint = {
    x: (focus.x / width) * 1254,
    y: (focus.y / height) * 1254,
  };
  const projected = projectMapPoint(worldPoint, width, height, viewport);

  assert.ok(Math.abs(projected.x - focus.x) < 1e-9);
  assert.ok(Math.abs(projected.y - focus.y) < 1e-9);
});

test("viewBox projection matches the CSS-transformed map viewport", () => {
  const viewport = { scale: 2, panX: -100, panY: -200 };
  const viewBox = mapViewportToViewBox(viewport, 400, 400);

  assert.equal(viewBox.width, 627);
  assert.equal(viewBox.height, 627);
  assert.equal(viewBox.x, 156.75);
  assert.equal(viewBox.y, 313.5);
});

test("troop overlay projection moves positions without changing marker dimensions", () => {
  const point = { x: 627, y: 627 };
  const normal = projectMapPoint(point, 400, 400, DEFAULT_MAP_VIEWPORT);
  const zoomed = projectMapPoint(
    point,
    400,
    400,
    { scale: 2, panX: -100, panY: -80 },
  );

  assert.deepEqual(normal, { x: 200, y: 200 });
  assert.deepEqual(zoomed, { x: 300, y: 320 });
});

test("map bounds union contains every territory rectangle", () => {
  assert.deepEqual(
    unionMapBounds([
      { x: 100, y: 200, width: 50, height: 80 },
      { x: 140, y: 150, width: 100, height: 40 },
    ]),
    { x: 100, y: 150, width: 140, height: 130 },
  );
  assert.equal(unionMapBounds([]), null);
});

test("map fit centers compact bounds and respects maximum zoom", () => {
  const viewport = fitMapViewportToBounds({
    bounds: { x: 527, y: 527, width: 200, height: 200 },
    width: 400,
    height: 400,
    paddingRatio: 0,
  });

  assert.equal(viewport.scale, MAP_MAX_SCALE);
  assert.equal(viewport.panX, -400);
  assert.equal(viewport.panY, -400);
});

test("map fit returns the default viewport for the complete board", () => {
  assert.deepEqual(
    fitMapViewportToBounds({
      bounds: { x: 0, y: 0, width: 1254, height: 1254 },
      width: 390,
      height: 390,
      paddingRatio: 0,
    }),
    DEFAULT_MAP_VIEWPORT,
  );
});

test("map fit clamps groups near the world edge without exposing empty space", () => {
  const viewport = fitMapViewportToBounds({
    bounds: { x: 0, y: 0, width: 300, height: 300 },
    width: 400,
    height: 400,
    paddingRatio: 0,
  });

  assert.equal(viewport.scale, MAP_MAX_SCALE);
  assert.equal(viewport.panX, 0);
  assert.equal(viewport.panY, 0);
});

test("territory borders get thinner as map zoom increases", () => {
  const baseStroke = 4;
  const scale1 = mapStrokeWidthForScale(baseStroke, 1);
  const scale2 = mapStrokeWidthForScale(baseStroke, 2);
  const scale3 = mapStrokeWidthForScale(baseStroke, 3);

  assert.equal(scale1, baseStroke);
  assert.ok(scale1 > scale2);
  assert.ok(scale2 > scale3);

  const perceived1 = scale1 * 1;
  const perceived2 = scale2 * 2;
  const perceived3 = scale3 * 3;
  assert.ok(perceived1 > perceived2);
  assert.ok(perceived2 > perceived3);
});

test("territory stroke hierarchy remains stable at every supported zoom", () => {
  for (const scale of [1, 1.5, 2, 3]) {
    assert.ok(
      mapStrokeWidthForScale(8, scale) > mapStrokeWidthForScale(7, scale),
    );
    assert.ok(
      mapStrokeWidthForScale(7, scale) > mapStrokeWidthForScale(6, scale),
    );
    assert.ok(
      mapStrokeWidthForScale(6, scale) > mapStrokeWidthForScale(5, scale),
    );
    assert.ok(
      mapStrokeWidthForScale(5, scale) > mapStrokeWidthForScale(4, scale),
    );
  }
});

test("map viewport interpolation reaches exact endpoints and clamps progress", () => {
  const from = { scale: 1, panX: 0, panY: 0 };
  const to = { scale: 3, panX: -600, panY: -300 };

  assert.deepEqual(interpolateMapViewport(from, to, -1), from);
  assert.deepEqual(interpolateMapViewport(from, to, 0.5), {
    scale: 2,
    panX: -300,
    panY: -150,
  });
  assert.deepEqual(interpolateMapViewport(from, to, 2), to);
});

test("autofocus easing is fast at the start and exact at both endpoints", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
  assert.ok(easeOutCubic(0.75) > easeOutCubic(0.5));
});

test("autofocus duration stays intentionally short", () => {
  assert.ok(MAP_AUTO_FOCUS_DURATION_MS >= 200);
  assert.ok(MAP_AUTO_FOCUS_DURATION_MS <= 300);
});
