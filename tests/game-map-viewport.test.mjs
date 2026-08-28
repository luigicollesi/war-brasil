import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MAP_VIEWPORT,
  MAP_MAX_SCALE,
  clampMapViewport,
  mapViewportToViewBox,
  projectMapPoint,
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
