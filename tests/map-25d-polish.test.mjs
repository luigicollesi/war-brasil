import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const board = readFileSync("src/components/interactive-board.tsx", "utf8");
const zoom = readFileSync("src/components/map-zoom-controller.tsx", "utf8");
const interaction = readFileSync(
  "src/lib/client/map/territory-svg-interaction.ts",
  "utf8",
);
const visualState = readFileSync(
  "src/lib/client/map/territory-visual-state.ts",
  "utf8",
);
const layout = readFileSync("src/app/layout.tsx", "utf8");
const polish = readFileSync("src/app/map-25d-polish.css", "utf8");
const svg = readFileSync("public/mapa-war-brasil-25d.svg", "utf8");

test("zoom separa stroke semântico do stroke compensado de renderização", () => {
  assert.match(visualState, /--territory-stroke-width/);
  assert.match(visualState, /--territory-render-stroke-width/);
  assert.match(zoom, /TERRITORY_BASE_STROKE_PROPERTY/);
  assert.match(zoom, /TERRITORY_RENDER_STROKE_PROPERTY/);
  assert.match(zoom, /getComputedStyle\(path\)/);
  assert.match(zoom, /getPropertyValue\(TERRITORY_BASE_STROKE_PROPERTY\)/);
  assert.match(zoom, /attributeFilter: \["class"\]/);
  assert.doesNotMatch(zoom, /Number\.parseFloat\(path\.style\.strokeWidth\)/);
});

test("hover e seleção tratam face e profundidade como uma única peça visual", () => {
  assert.match(visualState, /\.territory-depth\.is-hovered/);
  assert.match(visualState, /\.territory-depth\.is-selected/);
  assert.match(visualState, /for \(const depth of nodes\.depths\)/);
  assert.match(board, /applyTerritoryHoverState\(previousNodes, false\)/);
  assert.match(board, /applyTerritoryHoverState\(nextNodes, true\)/);
  assert.match(board, /applyTerritoryVisualState\(nodes,/);
  assert.doesNotMatch(board, /applyTerritoryHoverState\(previousNodes\.face/);
});

test("laterais continuam ponteiro-interativas sem duplicar semântica acessível", () => {
  assert.match(interaction, /surface !== nodes\.face/);
  assert.match(interaction, /surface\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(interaction, /surface\.removeAttribute\("tabindex"\)/);
  assert.match(interaction, /surface\.removeAttribute\("role"\)/);
  assert.match(interaction, /surface\.style\.pointerEvents = "visiblePainted"/);
});

test("tokens de tropas compartilham linguagem material em desktop e mobile", () => {
  assert.match(board, /const markerMaterial = territoryMaterial\(territory\.ownerColor\)/g);
  assert.match(board, /fillStyle = "#f3efe4"/);
  assert.match(board, /strokeStyle = markerMaterial\.side\[0\]/);
  assert.match(board, /fill="#f3efe4"/);
  assert.match(board, /stroke=\{markerMaterial\.side\[0\]\}/);
  assert.match(board, /fill="#17201c"/);
});

test("integração visual remove sombra externa duplicada e reduz halo do fundo", () => {
  assert.match(layout, /import "\.\/map-25d-polish\.css"/);
  assert.match(polish, /\.game-map-surface\s*\{[\s\S]*?filter: none;/);
  assert.match(polish, /rgba\(63, 117, 91, 0\.12\)/);
  assert.match(polish, /\.game-territory-tooltip/);
});

test("gestos móveis continuam protegendo seleção acidental", () => {
  assert.match(zoom, /CLICK_SUPPRESSION_MS = 450/);
  assert.match(zoom, /suppressSelection\(\)/);
  assert.match(zoom, /svg\.addEventListener\("click", onClickCapture, true\)/);
  assert.match(zoom, /event\.stopImmediatePropagation\(\)/);
});

test("polimento não altera geometria canônica do mapa", () => {
  assert.match(svg, /viewBox="0 0 1254 1254"/);
  assert.match(svg, /data-layout="2\.5d-premium-v2"/);
  assert.match(svg, /data-territory-id="40"/);
  assert.match(board, /territoryGeometryFromPath\(path\)/);
});
