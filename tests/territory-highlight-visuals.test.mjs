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

test("runtime highlight overlays and radial gradients are removed", () => {
  assert.doesNotMatch(svgNodesSource, /radialGradient/);
  assert.doesNotMatch(svgNodesSource, /HIGHLIGHT_DEFS_ID/);
  assert.doesNotMatch(svgNodesSource, /HIGHLIGHT_GROUP_ID/);
  assert.doesNotMatch(svgNodesSource, /ensureTerritoryHighlightOverlay/);
  assert.doesNotMatch(svgNodesSource, /highlight:\s*SVGPathElement/);
  assert.doesNotMatch(svgNodesSource, /classList\.add\("territory-highlight"\)/);
  assert.doesNotMatch(visualStateSource, /\.territory-highlight/);
});

test("six surface palettes are hardcoded with metallic highlight and two hover variants", () => {
  assert.match(materialSource, /const TERRITORY_SURFACE_PALETTES/);
  assert.match(materialSource, /forest:[\s\S]*highlight: "#86d2a5"[\s\S]*hover: "#62c88b"[\s\S]*highlightedHover: "#a4e6bd"/);
  assert.match(materialSource, /ocean:[\s\S]*highlight: "#82bfe8"[\s\S]*hover: "#55aeee"[\s\S]*highlightedHover: "#a2d5f4"/);
  assert.match(materialSource, /sun:[\s\S]*highlight: "#e7c552"[\s\S]*hover: "#f0c62e"[\s\S]*highlightedHover: "#f3dd76"/);
  assert.match(materialSource, /ruby:[\s\S]*highlight: "#e6817f"[\s\S]*hover: "#ee625f"[\s\S]*highlightedHover: "#f1a09b"/);
  assert.match(materialSource, /violet:[\s\S]*highlight: "#b68bd8"[\s\S]*hover: "#ad67df"[\s\S]*highlightedHover: "#cda7e7"/);
  assert.match(materialSource, /orange:[\s\S]*highlight: "#e99453"[\s\S]*hover: "#f18336"[\s\S]*highlightedHover: "#f2af72"/);

  const surfacePalette = materialSource.slice(
    materialSource.indexOf("const TERRITORY_SURFACE_PALETTES"),
    materialSource.indexOf("const NEUTRAL_TERRITORY_MATERIAL"),
  );
  assert.doesNotMatch(surfacePalette, /#fff(?:fff)?\b/i);
  assert.doesNotMatch(materialSource, /SELECTED_TERRITORY_MATERIALS/);
  assert.doesNotMatch(materialSource, /selectedTerritoryMaterial/);
});

test("semantic state remains separate from the four surface states", () => {
  assert.match(visualStateSource, /export function resolveTerritorySemanticState/);
  assert.match(visualStateSource, /export function resolveTerritorySurfaceState/);

  const semanticResolver = visualStateSource.slice(
    visualStateSource.indexOf("export function resolveTerritorySemanticState"),
    visualStateSource.indexOf("export function resolveTerritorySurfaceState"),
  );
  const orderedLines = [
    'if (face.classList.contains("is-opening-highlight")) return "opening";',
    'if (face.classList.contains("is-selected")) return "selected";',
    'if (face.classList.contains("is-target-selectable")) return "target";',
    'if (face.classList.contains("is-target")) return "target-blocked";',
    'if (face.classList.contains("is-available")) return "available";',
  ];
  const order = orderedLines.map((line) => semanticResolver.indexOf(line));
  assert.ok(order.every((index) => index >= 0));
  for (let index = 1; index < order.length; index += 1) {
    assert.ok(order[index - 1] < order[index]);
  }

  const surfaceResolver = visualStateSource.slice(
    visualStateSource.indexOf("export function resolveTerritorySurfaceState"),
    visualStateSource.indexOf("function refreshTerritoryVisualState"),
  );
  assert.match(surfaceResolver, /const highlighted = semanticState !== "none"/);
  assert.match(surfaceResolver, /if \(highlighted && hovered\) return "highlighted-hover"/);
  assert.match(surfaceResolver, /if \(highlighted\) return "highlighted"/);
  assert.match(surfaceResolver, /if \(hovered\) return "hover"/);
  assert.match(surfaceResolver, /return "normal"/);
  assert.match(visualStateSource, /dataset\.semanticState = semanticState/);
  assert.match(visualStateSource, /dataset\.surfaceState = resolveTerritorySurfaceState/);
});

test("all gameplay highlights share one face fill while hover has contextual fills", () => {
  assert.match(visualStateSource, /data-surface-state="hover"[\s\S]*--territory-hover-fill/);
  assert.match(visualStateSource, /data-surface-state="highlighted"[\s\S]*--territory-highlight-fill/);
  assert.match(visualStateSource, /data-surface-state="highlighted-hover"[\s\S]*--territory-highlight-hover-fill/);
  assert.match(svgNodesSource, /--territory-base-fill/);
  assert.match(svgNodesSource, /--territory-highlight-fill/);
  assert.match(svgNodesSource, /--territory-hover-fill/);
  assert.match(svgNodesSource, /--territory-highlight-hover-fill/);
  assert.match(svgNodesSource, /face\.setAttribute\("fill", `url\(#face-grad-\$\{id\}\)`\)/);
});

test("semantic borders distinguish reasons without changing the surface palette", () => {
  assert.match(visualStateSource, /data-semantic-state="available"[\s\S]*1\.8/);
  assert.match(visualStateSource, /data-semantic-state="target-blocked"[\s\S]*stroke-dasharray: 5 3/);
  assert.match(visualStateSource, /data-semantic-state="target"[\s\S]*2\.2/);
  assert.match(visualStateSource, /data-semantic-state="selected"[\s\S]*2\.7/);
  assert.match(visualStateSource, /data-semantic-state="opening"[\s\S]*2\.4/);
  assert.match(visualStateSource, /data-semantic-state="selected"\]\.is-hovered[\s\S]*2\.9/);
});

test("surface interaction does not animate or rewrite 2.5D material layers", () => {
  assert.match(visualStateSource, /transition: none;/);
  assert.doesNotMatch(visualStateSource, /transition:\s*(?:opacity|fill|stroke|stroke-width|stroke-opacity)/);
  assert.doesNotMatch(visualStateSource, /faceStops/);
  assert.doesNotMatch(visualStateSource, /sideStops/);
  assert.doesNotMatch(visualStateSource, /deepRim/);
  assert.doesNotMatch(visualStateSource, /bevelDark/);
  assert.doesNotMatch(
    visualStateSource,
    /nodes\.depths[\s\S]*classList\.toggle\("is-/,
  );
});

test("regional resting borders remain while active borders use owner colors", () => {
  assert.match(visualStateSource, /norte: \{ stroke: "#67f58b"/);
  assert.match(visualStateSource, /nordeste: \{ stroke: "#63b4ff"/);
  assert.match(visualStateSource, /"centro-oeste": \{ stroke: "#ffd84d"/);
  assert.match(visualStateSource, /sudeste: \{ stroke: "#ff6262"/);
  assert.match(visualStateSource, /sul: \{ stroke: "#ff9a3d"/);
  assert.match(visualStateSource, /--territory-highlight-edge-strong/);
  assert.match(svgNodesSource, /--territory-highlight-edge/);
  assert.match(svgNodesSource, /--territory-highlight-edge-strong/);
});
