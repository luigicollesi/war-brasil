import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { computeTerritoryExpansionTransform } from "../.test-build/client/map/territory-visual-state.js";

const visualStateSource = readFileSync(
  "src/lib/client/map/territory-visual-state.ts",
  "utf8",
);

function transformedBounds(bounds, transform) {
  return {
    left: bounds.x * transform.scaleX + transform.translateX,
    right:
      (bounds.x + bounds.width) * transform.scaleX + transform.translateX,
    top: bounds.y * transform.scaleY + transform.translateY,
    bottom:
      (bounds.y + bounds.height) * transform.scaleY + transform.translateY,
  };
}

function assertClose(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

test("highlight expands small and large territories by the same absolute amount", () => {
  const small = { x: 20, y: 30, width: 50, height: 40 };
  const large = { x: 100, y: 150, width: 400, height: 320 };

  const smallTransform = computeTerritoryExpansionTransform({
    ...small,
    screenScaleX: 1,
    screenScaleY: 1,
    expansionPx: 4,
  });
  const largeTransform = computeTerritoryExpansionTransform({
    ...large,
    screenScaleX: 1,
    screenScaleY: 1,
    expansionPx: 4,
  });

  const smallResult = transformedBounds(small, smallTransform);
  const largeResult = transformedBounds(large, largeTransform);

  assertClose(smallResult.left, small.x - 4);
  assertClose(smallResult.right, small.x + small.width + 4);
  assertClose(smallResult.top, small.y - 4);
  assertClose(smallResult.bottom, small.y + small.height + 4);

  assertClose(largeResult.left, large.x - 4);
  assertClose(largeResult.right, large.x + large.width + 4);
  assertClose(largeResult.top, large.y - 4);
  assertClose(largeResult.bottom, large.y + large.height + 4);

  assert.ok(
    smallTransform.scaleX > largeTransform.scaleX,
    "small territory must use a larger percentage scale to gain the same pixels",
  );
});

test("highlight compensates the SVG screen scale to preserve pixel growth", () => {
  const bounds = { x: 20, y: 30, width: 100, height: 80 };
  const transform = computeTerritoryExpansionTransform({
    ...bounds,
    screenScaleX: 2,
    screenScaleY: 4,
    expansionPx: 4,
  });
  const result = transformedBounds(bounds, transform);

  assertClose((bounds.x - result.left) * 2, 4);
  assertClose((result.right - (bounds.x + bounds.width)) * 2, 4);
  assertClose((bounds.y - result.top) * 4, 4);
  assertClose((result.bottom - (bounds.y + bounds.height)) * 4, 4);
});

test("runtime highlight grows the complete 2.5d piece and keeps hit geometry untouched", () => {
  assert.match(visualStateSource, /const HIGHLIGHT_EXPANSION_PX = 4/);
  assert.match(visualStateSource, /const HOVER_EXPANSION_PX = 2/);
  assert.match(visualStateSource, /\.\.\.nodes\.depths/);
  assert.match(visualStateSource, /nodes\.deepRim/);
  assert.match(visualStateSource, /nodes\.bevelDark/);
  assert.match(visualStateSource, /nodes\.bevelLight/);
  assert.match(visualStateSource, /nodes\.face/);
  assert.match(visualStateSource, /getBBox\(\)/);
  assert.match(visualStateSource, /getScreenCTM\(\)/);
  assert.match(visualStateSource, /Math\.hypot\(screenMatrix\.a, screenMatrix\.b\)/);
  assert.match(visualStateSource, /Math\.hypot\(screenMatrix\.c, screenMatrix\.d\)/);
  assert.doesNotMatch(visualStateSource, /scale\(1\.0\d+/);
  assert.doesNotMatch(visualStateSource, /data-map-hit-layer/);
});

test("semantic states are visibly stronger than the neutral territory", () => {
  assert.match(visualStateSource, /\.territory\.is-available[\s\S]*brightness\(1\.14\)[\s\S]*saturate\(1\.15\)/);
  assert.match(visualStateSource, /\.territory\.is-target-selectable[\s\S]*brightness\(1\.18\)[\s\S]*saturate\(1\.2\)/);
  assert.match(visualStateSource, /\.territory\.is-selected[\s\S]*brightness\(1\.22\)[\s\S]*saturate\(1\.24\)/);
  assert.match(visualStateSource, /drop-shadow\(0 0 7px/);
});
