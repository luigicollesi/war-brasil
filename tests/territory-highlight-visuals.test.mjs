import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const visualStateSource = readFileSync(
  "src/lib/client/map/territory-visual-state.ts",
  "utf8",
);

test("territory highlighting never changes SVG geometry or size", () => {
  assert.doesNotMatch(visualStateSource, /HIGHLIGHT_EXPANSION_PX/);
  assert.doesNotMatch(visualStateSource, /HOVER_EXPANSION_PX/);
  assert.doesNotMatch(visualStateSource, /computeTerritoryExpansionTransform/);
  assert.doesNotMatch(visualStateSource, /refreshTerritoryVisualExpansion/);
  assert.doesNotMatch(visualStateSource, /getBBox\(\)/);
  assert.doesNotMatch(visualStateSource, /getScreenCTM\(\)/);
  assert.doesNotMatch(visualStateSource, /setAttribute\(\s*["']transform["']/);
  assert.doesNotMatch(visualStateSource, /transition:\s*transform/);
});

test("semantic states use stronger color contrast instead of scaling", () => {
  assert.match(
    visualStateSource,
    /\.territory\.is-available[\s\S]*brightness\(1\.22\)[\s\S]*saturate\(1\.35\)/,
  );
  assert.match(
    visualStateSource,
    /\.territory\.is-target-selectable[\s\S]*brightness\(1\.32\)[\s\S]*saturate\(1\.55\)/,
  );
  assert.match(
    visualStateSource,
    /\.territory\.is-selected[\s\S]*brightness\(1\.4\)[\s\S]*saturate\(1\.7\)/,
  );
  assert.match(visualStateSource, /--territory-stroke-width:\s*3\.4/);
  assert.match(visualStateSource, /drop-shadow\(0 0 11px/);
});

test("regional highlight palette stays vivid and semantic hover remains weaker", () => {
  assert.match(visualStateSource, /norte: \{ stroke: "#67f58b"/);
  assert.match(visualStateSource, /nordeste: \{ stroke: "#63b4ff"/);
  assert.match(visualStateSource, /"centro-oeste": \{ stroke: "#ffd84d"/);
  assert.match(visualStateSource, /sudeste: \{ stroke: "#ff6262"/);
  assert.match(visualStateSource, /sul: \{ stroke: "#ff9a3d"/);
  assert.match(
    visualStateSource,
    /\.territory\.is-hovered[\s\S]*brightness\(1\.12\)[\s\S]*saturate\(1\.18\)/,
  );
});
