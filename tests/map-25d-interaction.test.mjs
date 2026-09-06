import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const board = readFileSync("src/components/interactive-board.tsx", "utf8");
const interaction = readFileSync(
  "src/lib/client/map/territory-svg-interaction.ts",
  "utf8",
);
const nodes = readFileSync(
  "src/lib/client/map/territory-svg-nodes.ts",
  "utf8",
);
const visualState = readFileSync(
  "src/lib/client/map/territory-visual-state.ts",
  "utf8",
);
const svg = readFileSync("public/mapa-war-brasil-25d.svg", "utf8");

test("registry 2.5D separa superfícies interativas das camadas decorativas", () => {
  assert.match(nodes, /interactiveSurfaces: SVGPathElement\[\]/);
  assert.match(nodes, /interactiveSurfaces: \[face, \.\.\.depths\]/);
  assert.match(interaction, /surface\.dataset\.territoryInteractive = "true"/);
  assert.match(interaction, /surface\.style\.pointerEvents = "visiblePainted"/);
  assert.doesNotMatch(interaction, /deepRim.*territoryInteractive/s);
  assert.doesNotMatch(interaction, /bevelLight.*territoryInteractive/s);
});

test("eventos de face e profundidade são normalizados por territoryId", () => {
  assert.match(interaction, /\[data-territory-interactive="true"\]\[data-territory-id\]/);
  assert.match(interaction, /export function territoryIdFromNode/);
  assert.match(interaction, /export function territoryIdFromEvent/);
  assert.match(interaction, /root\.contains\(target\)/);
  assert.match(board, /territoryIdFromEvent\(event, root\)/);
  assert.match(board, /territoryIdFromNode\(related, root\)/);
  assert.doesNotMatch(board, /territoryPathFromEvent/);
});

test("hover é semântico e não reinicia entre face e lateral do mesmo território", () => {
  assert.match(board, /if \(previousId === nextId\) return/);
  assert.match(board, /if \(fromId === toId\) return/);
  assert.match(board, /applyTerritoryHoverState\(previousNodes\.face, false\)/);
  assert.match(board, /applyTerritoryHoverState\(nextNodes\.face, true\)/);
  assert.match(visualState, /\.territory\.is-hovered/);
});

test("teclado permanece restrito às faces enquanto ponteiro usa a raiz 2.5D", () => {
  assert.match(board, /const faceRoot = mapDocument\?\.querySelector\("#territories"\)/);
  assert.match(board, /mapDocument\?\.querySelector\("#board"\)/);
  assert.match(board, /faceRoot\.addEventListener\("keydown"/);
  assert.match(board, /root\.addEventListener\("click"/);
  assert.match(board, /root\.addEventListener\("pointerover"/);
  assert.match(board, /root\.addEventListener\("pointermove"/);
  assert.match(board, /root\.addEventListener\("pointerout"/);
});

test("geometria e asset 2.5D permanecem canônicos", () => {
  assert.match(board, /territoryGeometryFromPath\(path\)/);
  assert.match(board, /data="\/mapa-war-brasil-25d\.svg"/);
  assert.match(svg, /viewBox="0 0 1254 1254"/);
  assert.match(svg, /data-layout="2\.5d-premium-v2"/);
  assert.match(svg, /data-territory-id="40"/);
  assert.match(svg, /data-layer="depth-4"/);
});
