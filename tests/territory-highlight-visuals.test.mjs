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
  assert.match(visualStateSource, /filter: none !important;/);
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

test("semantic state stays in memory and remains separate from four surface states", () => {
  assert.match(visualStateSource, /new WeakMap<SVGPathElement, TerritoryRuntimeVisualState>/);
  assert.match(visualStateSource, /function semanticStateFromVisualState/);
  assert.match(visualStateSource, /if \(state\.openingHighlight\) return "opening"/);
  assert.match(visualStateSource, /if \(state\.selected\) return "selected"/);
  assert.match(visualStateSource, /if \(state\.targetSelectable\) return "target"/);
  assert.match(visualStateSource, /if \(state\.target\) return "target-blocked"/);
  assert.match(visualStateSource, /if \(state\.available\) return "available"/);
  assert.match(visualStateSource, /export function resolveTerritorySemanticState/);
  assert.match(visualStateSource, /export function resolveTerritorySurfaceState/);
  assert.match(visualStateSource, /const highlighted = semanticState !== "none"/);
  assert.match(visualStateSource, /state\?\.hovered \|\| state\?\.keyboardFocused/);
  assert.match(visualStateSource, /if \(highlighted && hovered\) return "highlighted-hover"/);
  assert.match(visualStateSource, /if \(highlighted\) return "highlighted"/);
  assert.match(visualStateSource, /if \(hovered\) return "hover"/);
  assert.doesNotMatch(visualStateSource, /dataset\.semanticState/);
  assert.doesNotMatch(visualStateSource, /dataset\.surfaceState/);
});

test("all gameplay interaction writes collapse to one face fill variable", () => {
  assert.match(visualStateSource, /SURFACE_FILL_PROPERTY = "--territory-state-fill"/);
  assert.match(visualStateSource, /function fillForSurfaceState/);
  assert.match(visualStateSource, /--territory-hover-fill/);
  assert.match(visualStateSource, /--territory-highlight-fill/);
  assert.match(visualStateSource, /--territory-highlight-hover-fill/);
  assert.match(visualStateSource, /face\.style\.setProperty\(SURFACE_FILL_PROPERTY, nextFill\)/);
  assert.match(
    visualStateSource,
    /fill: var\(\$\{SURFACE_FILL_PROPERTY\}, var\(--territory-base-fill\)\) !important/,
  );
  assert.doesNotMatch(visualStateSource, /classList\.toggle\("is-/);
  assert.match(svgNodesSource, /--territory-base-fill/);
  assert.match(svgNodesSource, /--territory-highlight-fill/);
  assert.match(svgNodesSource, /--territory-hover-fill/);
  assert.match(svgNodesSource, /--territory-highlight-hover-fill/);
});

test("semantic reasons no longer rewrite borders, dash arrays, or opacity", () => {
  assert.match(visualStateSource, /stroke: var\(--territory-region-stroke, #e4dcc0\)/);
  assert.match(visualStateSource, /stroke-opacity: \.42/);
  assert.match(visualStateSource, /stroke-width: var\(--territory-render-stroke-width, \.9\)/);
  assert.match(visualStateSource, /stroke-dasharray: none/);
  assert.doesNotMatch(visualStateSource, /data-semantic-state=/);
  assert.doesNotMatch(visualStateSource, /stroke-dasharray: 5 3/);
  assert.doesNotMatch(visualStateSource, /classList\.toggle\("is-selected"/);
  assert.doesNotMatch(visualStateSource, /classList\.toggle\("is-target"/);
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

test("regional borders are static and independent from active state", () => {
  assert.match(visualStateSource, /data-region="norte"[\s\S]*#67f58b/);
  assert.match(visualStateSource, /data-region="nordeste"[\s\S]*#63b4ff/);
  assert.match(visualStateSource, /data-region="centro-oeste"[\s\S]*#ffd84d/);
  assert.match(visualStateSource, /data-region="sudeste"[\s\S]*#ff6262/);
  assert.match(visualStateSource, /data-region="sul"[\s\S]*#ff9a3d/);
  assert.doesNotMatch(visualStateSource, /--territory-highlight-edge/);
  assert.doesNotMatch(visualStateSource, /--territory-highlight-edge-strong/);
});
