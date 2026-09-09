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

test("dynamic territory states avoid expensive SVG filters", () => {
  assert.doesNotMatch(visualStateSource, /brightness\(/);
  assert.doesNotMatch(visualStateSource, /saturate\(/);
  assert.doesNotMatch(visualStateSource, /drop-shadow\(/);
  assert.doesNotMatch(visualStateSource, /transition:\s*filter/);
});

test("semantic states use lightweight stroke contrast", () => {
  assert.match(
    visualStateSource,
    /\.territory\.is-hovered[\s\S]*--territory-stroke-width:\s*1\.7[\s\S]*stroke-opacity:\s*\.9/,
  );
  assert.match(
    visualStateSource,
    /\.territory\.is-available[\s\S]*--territory-stroke-width:\s*2\.1[\s\S]*stroke-opacity:\s*\.96/,
  );
  assert.match(
    visualStateSource,
    /\.territory\.is-target-selectable[\s\S]*--territory-stroke-width:\s*2\.8[\s\S]*stroke-opacity:\s*1/,
  );
  assert.match(
    visualStateSource,
    /\.territory\.is-selected[\s\S]*--territory-stroke-width:\s*3\.4[\s\S]*stroke-opacity:\s*1/,
  );
  assert.match(
    visualStateSource,
    /transition:\s*stroke \.1s ease, stroke-opacity \.1s ease, stroke-width \.1s ease/,
  );
});

test("regional highlight palette stays vivid without dynamic depth effects", () => {
  assert.match(visualStateSource, /norte: \{ stroke: "#67f58b" \}/);
  assert.match(visualStateSource, /nordeste: \{ stroke: "#63b4ff" \}/);
  assert.match(visualStateSource, /"centro-oeste": \{ stroke: "#ffd84d" \}/);
  assert.match(visualStateSource, /sudeste: \{ stroke: "#ff6262" \}/);
  assert.match(visualStateSource, /sul: \{ stroke: "#ff9a3d" \}/);
  assert.doesNotMatch(
    visualStateSource,
    /nodes\.depths[\s\S]*classList\.toggle\("is-/,
  );
});
