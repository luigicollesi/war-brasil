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
  assert.doesNotMatch(svgNodesSource, /setAttribute\(\s*["']transform["']/);
});

test("dynamic territory states avoid expensive SVG filters", () => {
  for (const source of [visualStateSource, svgNodesSource]) {
    assert.doesNotMatch(source, /brightness\(/);
    assert.doesNotMatch(source, /saturate\(/);
    assert.doesNotMatch(source, /drop-shadow\(/);
    assert.doesNotMatch(source, /feGaussianBlur/);
    assert.doesNotMatch(source, /feSpecularLighting/);
  }
  assert.doesNotMatch(visualStateSource, /transition:\s*filter/);
});

test("six shared radial gradients create a curved chromatic state layer", () => {
  assert.match(svgNodesSource, /createElementNS\(SVG_NS, "radialGradient"\)/);
  assert.match(svgNodesSource, /gradientUnits", "objectBoundingBox"/);
  assert.match(svgNodesSource, /gradientTransform/);
  assert.match(svgNodesSource, /rotate\(-22\)/);
  assert.match(svgNodesSource, /scale\(1\.35 \.68\)/);
  assert.match(svgNodesSource, /stop-opacity/);
  assert.match(svgNodesSource, /"49%", palette\.peak, "\.70"/);
  for (const color of ["forest", "ocean", "sun", "ruby", "violet", "orange"]) {
    assert.match(svgNodesSource, new RegExp(`territory-highlight-\\$\\{color\\}`));
    assert.match(materialSource, new RegExp(`${color}:`));
  }
});

test("highlight palettes remain hardcoded and chromatic instead of white", () => {
  assert.match(materialSource, /const TERRITORY_HIGHLIGHT_PALETTES/);
  assert.match(materialSource, /forest:[\s\S]*#86d2a5[\s\S]*#b9e9ca/);
  assert.match(materialSource, /ocean:[\s\S]*#82bfe8[\s\S]*#b8dcf3/);
  assert.match(materialSource, /sun:[\s\S]*#e7c552[\s\S]*#f3df8b/);
  assert.match(materialSource, /ruby:[\s\S]*#e6817f[\s\S]*#f1aaa4/);
  assert.match(materialSource, /violet:[\s\S]*#b68bd8[\s\S]*#d4b7e9/);
  assert.match(materialSource, /orange:[\s\S]*#e99453[\s\S]*#f2ba84/);
  const highlightPalette = materialSource.slice(
    materialSource.indexOf("const TERRITORY_HIGHLIGHT_PALETTES"),
    materialSource.indexOf("const NEUTRAL_TERRITORY_MATERIAL"),
  );
  assert.doesNotMatch(highlightPalette, /#fff(?:fff)?\b/i);
  assert.doesNotMatch(materialSource, /SELECTED_TERRITORY_MATERIALS/);
  assert.doesNotMatch(materialSource, /selectedTerritoryMaterial/);
});

test("every highlight reason resolves through one precedence chain", () => {
  assert.match(visualStateSource, /export function resolveTerritoryHighlightKind/);
  const resolver = visualStateSource.slice(
    visualStateSource.indexOf("export function resolveTerritoryHighlightKind"),
    visualStateSource.indexOf("function refreshTerritoryHighlightState"),
  );
  const orderedLines = [
    'if (face.classList.contains("is-opening-highlight")) return "opening";',
    'if (face.classList.contains("is-selected")) return "selected";',
    'if (face.classList.contains("is-target-selectable")) return "target";',
    'if (face.classList.contains("is-target")) return "target-blocked";',
    'if (face.classList.contains("is-available")) return "available";',
    'if (face.classList.contains("is-hovered")) return "hover";',
  ];
  const order = orderedLines.map((line) => resolver.indexOf(line));
  assert.ok(order.every((index) => index >= 0));
  for (let index = 1; index < order.length; index += 1) {
    assert.ok(order[index - 1] < order[index]);
  }
  assert.match(visualStateSource, /nodes\.face\.dataset\.highlightKind = kind/);
  assert.match(visualStateSource, /nodes\.highlight\.dataset\.highlightKind = kind/);
});

test("state intensity is lightweight and only overlay opacity transitions", () => {
  assert.match(visualStateSource, /data-highlight-kind="hover"[\s\S]*1\.45/);
  assert.match(visualStateSource, /data-highlight-kind="available"[\s\S]*1\.8/);
  assert.match(visualStateSource, /data-highlight-kind="target-blocked"[\s\S]*stroke-dasharray: 5 3/);
  assert.match(visualStateSource, /data-highlight-kind="target"[\s\S]*2\.2/);
  assert.match(visualStateSource, /data-highlight-kind="selected"[\s\S]*2\.7/);
  assert.match(visualStateSource, /data-highlight-kind="opening"[\s\S]*2\.4/);
  assert.match(visualStateSource, /\.territory-highlight[\s\S]*transition: opacity \.1s ease-out/);
  assert.doesNotMatch(visualStateSource, /transition:\s*stroke/);
  assert.doesNotMatch(visualStateSource, /transition:\s*stroke-width/);
});

test("highlight overlay is non-interactive and depth layers remain static", () => {
  assert.match(svgNodesSource, /classList\.add\("territory-highlight"\)/);
  assert.match(svgNodesSource, /pointer-events", "none"/);
  assert.match(svgNodesSource, /highlightGroup/);
  assert.match(svgNodesSource, /applyHighlightPalette\(nodes, material\.playerColor\)/);
  assert.doesNotMatch(
    visualStateSource,
    /nodes\.depths[\s\S]*classList\.toggle\("is-/,
  );
});

test("regional resting borders remain available while highlighted borders use owner color", () => {
  assert.match(visualStateSource, /norte: \{ stroke: "#67f58b"/);
  assert.match(visualStateSource, /nordeste: \{ stroke: "#63b4ff"/);
  assert.match(visualStateSource, /"centro-oeste": \{ stroke: "#ffd84d"/);
  assert.match(visualStateSource, /sudeste: \{ stroke: "#ff6262"/);
  assert.match(visualStateSource, /sul: \{ stroke: "#ff9a3d"/);
  assert.match(visualStateSource, /--territory-highlight-edge-strong/);
  assert.match(svgNodesSource, /--territory-highlight-edge/);
  assert.match(svgNodesSource, /--territory-highlight-edge-strong/);
});
