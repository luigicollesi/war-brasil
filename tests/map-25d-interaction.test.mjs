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

test("painted top faces own pointer targeting directly", () => {
  assert.match(hitGeometry, /face\.dataset\.territoryHit = "true"/);
  assert.match(hitGeometry, /face\.dataset\.territoryId = String\(id\)/);
  assert.match(hitGeometry, /face\.dataset\.territorySurface = "face"/);
  assert.match(hitGeometry, /face\.style\.pointerEvents = "fill"/);
  assert.match(interaction, /\[data-territory-hit="true"\]\[data-territory-id\]/);
});

test("2.5d depth and bevel surfaces never intercept interaction", () => {
  assert.match(hitGeometry, /for \(const depth of nodes\.depths\)/);
  assert.match(hitGeometry, /depth\.style\.pointerEvents = "none"/);
  assert.match(
    hitGeometry,
    /\[nodes\.deepRim, nodes\.bevelLight, nodes\.bevelDark\]/,
  );
  assert.match(hitGeometry, /decoration\.style\.pointerEvents = "none"/);
  assert.match(hitGeometry, /result\.set\(id, \{ face, depths: \[\] \}\)/);
});

test("interaction no longer duplicates or recalculates territory geometry", () => {
  assert.match(hitGeometry, /LEGACY_HIT_LAYER_SELECTOR/);
  assert.match(hitGeometry, /boardRoot\.querySelector\(LEGACY_HIT_LAYER_SELECTOR\)\?\.remove\(\)/);
  assert.doesNotMatch(hitGeometry, /createElementNS\(/);
  assert.doesNotMatch(hitGeometry, /resolveHitPolygonPath/);
  assert.doesNotMatch(hitGeometry, /safeInsetPolygonPath/);
  assert.doesNotMatch(hitGeometry, /safeScaledPolygonPath/);
  assert.doesNotMatch(hitGeometry, /getBBox\(\)/);
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

test("hover state clears cleanly and caches the pointer target between moves", () => {
  assert.match(board, /setHoveredTerritoryId\(territoryIdFromEvent\(event, root\)\)/);
  assert.match(board, /event\.target !== lastPointerTargetRef\.current/);
  assert.match(board, /lastPointerTargetRef\.current = event\.target/);
  assert.match(board, /lastPointerTargetRef\.current = null/);
  assert.match(board, /applyTerritoryHoverState\(previousNodes, false\)/);
  assert.match(board, /applyTerritoryHoverState\(nextNodes, true\)/);
  assert.match(board, /tooltipRef\.current\?\.show/);
  assert.match(board, /tooltipRef\.current\?\.hide/);
  assert.doesNotMatch(board, /setHoveredTerritory/);
  assert.doesNotMatch(board, /relatedTarget/);
  assert.doesNotMatch(board, /pointerout/);
});

test("native SVG hover is neutralized while runtime fill owns highlighting", () => {
  assert.match(visualState, /\.territory:hover,/);
  assert.match(visualState, /filter: none !important;/);
  assert.match(visualState, /--territory-state-fill/);
  assert.match(visualState, /syncTerritorySurfaceFill/);
  assert.doesNotMatch(visualState, /classList\.toggle\("is-hovered"/);
  assert.doesNotMatch(visualState, /dataset\.surfaceState/);
});

test("keyboard remains one focus target per territory on the real face", () => {
  assert.match(hitGeometry, /face\.setAttribute\("role", "button"\)/);
  assert.match(hitGeometry, /face\.setAttribute\("tabindex", "0"\)/);
  assert.match(hitGeometry, /face\.setAttribute\("aria-label"/);
  assert.match(board, /root\.addEventListener\("keydown"/);
  assert.match(board, /applyTerritoryKeyboardFocusState/);
  assert.doesNotMatch(hitGeometry, /keyboard: isFace/);
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
