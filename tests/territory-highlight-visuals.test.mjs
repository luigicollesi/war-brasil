import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const visualStateSource = readFileSync(
  "src/lib/client/map/territory-visual-state.ts",
  "utf8",
);
const materialSource = readFileSync(
  "src/lib/client/map/territory-material.ts",
  "utf8",
);
const svgNodesSource = readFileSync(
  "src/lib/client/map/territory-svg-nodes.ts",
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
  assert.doesNotMatch(svgNodesSource, /brightness\(/);
  assert.doesNotMatch(svgNodesSource, /saturate\(/);
  assert.doesNotMatch(svgNodesSource, /drop-shadow\(/);
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
    /\.territory\.is-selected[\s\S]*--territory-stroke-width:\s*3\.4[\s\S]*stroke:\s*var\(--territory-selection-stroke,[\s\S]*stroke-opacity:\s*1/,
  );
  assert.match(
    visualStateSource,
    /transition:\s*stroke \.1s ease, stroke-opacity \.1s ease, stroke-width \.1s ease/,
  );
});

test("regional highlight palette stays vivid without dynamic depth effects", () => {
  assert.match(visualStateSource, /norte: \{ stroke: "#67f58b"/);
  assert.match(visualStateSource, /nordeste: \{ stroke: "#63b4ff"/);
  assert.match(visualStateSource, /"centro-oeste": \{ stroke: "#ffd84d"/);
  assert.match(visualStateSource, /sudeste: \{ stroke: "#ff6262"/);
  assert.match(visualStateSource, /sul: \{ stroke: "#ff9a3d"/);
  assert.doesNotMatch(
    visualStateSource,
    /nodes\.depths[\s\S]*classList\.toggle\("is-/,
  );
});

test("all six playable colors have hardcoded metallic selected palettes", () => {
  assert.match(materialSource, /const SELECTED_TERRITORY_MATERIALS/);
  assert.match(materialSource, /forest:[\s\S]*#c7f6da[\s\S]*#d8ffea[\s\S]*edgeLight: "#d9ffe8"[\s\S]*edgeDark: "#183b2c"/);
  assert.match(materialSource, /ocean:[\s\S]*#d3eeff[\s\S]*#dff4ff[\s\S]*edgeLight: "#e0f6ff"[\s\S]*edgeDark: "#143a62"/);
  assert.match(materialSource, /sun:[\s\S]*#fff2a6[\s\S]*#fff7c9[\s\S]*edgeLight: "#fff6bf"[\s\S]*edgeDark: "#61470c"/);
  assert.match(materialSource, /ruby:[\s\S]*#ffd0cc[\s\S]*#ffe3df[\s\S]*edgeLight: "#ffe0dc"[\s\S]*edgeDark: "#5a1f24"/);
  assert.match(materialSource, /violet:[\s\S]*#e8d8ff[\s\S]*#f0e5ff[\s\S]*edgeLight: "#f0e4ff"[\s\S]*edgeDark: "#37204f"/);
  assert.match(materialSource, /orange:[\s\S]*#ffe0be[\s\S]*#ffe9d3[\s\S]*edgeLight: "#ffe6ca"[\s\S]*edgeDark: "#592b0f"/);
});

test("selected material changes only lightweight paint properties and restores base face", () => {
  assert.match(svgNodesSource, /function applyFaceStops/);
  assert.match(svgNodesSource, /function applySelectedFaceMaterial/);
  assert.match(svgNodesSource, /--territory-selection-stroke/);
  assert.match(svgNodesSource, /nodes\.deepRim\?\.setAttribute\("stroke", material\.edgeDark\)/);
  assert.match(svgNodesSource, /nodes\.bevelDark\?\.setAttribute\("stroke", material\.edgeDark\)/);
  assert.match(svgNodesSource, /applyBaseFaceMaterial\(nodes, territoryMaterial\(color\)\)/);
  assert.match(visualStateSource, /applyTerritorySelectionState\(nodes, state\.selected\)/);
  assert.doesNotMatch(svgNodesSource, /setAttribute\(\s*["']transform["']/);
});
