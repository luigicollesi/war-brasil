import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const board = readFileSync("src/components/interactive-board.tsx", "utf8");
const interaction = readFileSync(
  "src/lib/client/map/territory-svg-interaction.ts",
  "utf8",
);
const hitGeometry = readFileSync(
  "src/lib/client/map/territory-hit-geometry.ts",
  "utf8",
);
const visualState = readFileSync(
  "src/lib/client/map/territory-visual-state.ts",
  "utf8",
);
const svg = readFileSync("public/mapa-war-brasil-25d.svg", "utf8");

test("visual paths no longer own pointer targeting", () => {
  assert.match(hitGeometry, /surface\.style\.pointerEvents = "none"/);
  assert.match(hitGeometry, /dataset\.territoryHit = "true"/);
  assert.match(hitGeometry, /pointer-events", "fill"/);
  assert.match(interaction, /\[data-territory-hit="true"\]\[data-territory-id\]/);
});

test("hit layer contains face and depth surfaces with one semantic territory id", () => {
  assert.match(hitGeometry, /dataset\.territorySurface = surface/);
  assert.match(hitGeometry, /visualSurface\.dataset\.layer \?\? "depth"/);
  assert.match(hitGeometry, /isFace\s*\?\s*"face"/);
  assert.match(hitGeometry, /dataset\.territoryId = String\(territoryId\)/);
  assert.match(interaction, /export function territoryIdFromEvent/);
});

test("hit z-order follows the actual SVG paint order instead of a duplicated hardcoded order", () => {
  assert.match(hitGeometry, /dataset\.mapHitOrder = "visual-paint-order"/);
  assert.match(
    hitGeometry,
    /boardRoot\.querySelectorAll<SVGPathElement>\([\s\S]*?path\.territory-depth\[data-territory-id\],[\s\S]*?path\.territory\[data-territory-id\]/,
  );
  assert.match(hitGeometry, /for \(const visualSurface of visualSurfaces\)/);
  assert.doesNotMatch(hitGeometry, /for \(const depthIndex of \[3, 2, 1, 0\]\)/);
});

test("masked visual pixels are not probed at runtime anymore", () => {
  for (const legacy of [
    "elementsFromPoint",
    "isPointInFill",
    "isPointInStroke",
    "getScreenCTM",
    "maskGeometryBySurface",
    "pointIsInsideVisibleMask",
  ]) {
    assert.doesNotMatch(interaction, new RegExp(legacy));
  }
});

test("hover state is semantic and clears on null or board leave", () => {
  assert.match(board, /setHoveredTerritoryId\(id\)/);
  assert.match(board, /const pointerLeave = \(\) => setHoveredTerritoryId\(null\)/);
  assert.match(board, /applyTerritoryHoverState\(previousNodes, false\)/);
  assert.match(board, /applyTerritoryHoverState\(nextNodes, true\)/);
  assert.doesNotMatch(board, /relatedTarget/);
  assert.doesNotMatch(board, /pointerout/);
});

test("native SVG hover is neutralized and semantic class owns highlighting", () => {
  assert.match(visualState, /\.territory:hover\s*\{[\s\S]*?filter: none;/);
  assert.match(visualState, /\.territory\.is-hovered/);
  assert.match(visualState, /\.territory-depth\.is-hovered/);
});

test("keyboard stays one focus target per territory", () => {
  assert.match(hitGeometry, /keyboard: isFace/);
  assert.match(hitGeometry, /path\.setAttribute\("role", "button"\)/);
  assert.match(hitGeometry, /path\.setAttribute\("tabindex", "0"\)/);
  assert.match(hitGeometry, /path\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(board, /root\.addEventListener\("keydown"/);
  assert.match(board, /applyTerritoryKeyboardFocusState/);
});

test("interaction is scoped to board-v2 instead of the whole embedded document", () => {
  assert.match(board, /querySelector\("#board-v2"\)/);
  assert.match(board, /data-map-interaction-root/);
  assert.doesNotMatch(board, /querySelector\("#board"\)/);
});

test("geometria canônica continua derivada da face visual original", () => {
  assert.match(board, /territoryGeometryFromPath\(path\)/);
  assert.match(board, /data="\/mapa-war-brasil-25d\.svg"/);
  assert.match(svg, /viewBox="0 0 1254 1254"/);
  assert.match(svg, /data-layout="2\.5d-premium-v2"/);
});
