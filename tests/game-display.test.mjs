import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("nome da carta ajusta tipografia pelo número de caracteres e permanece em uma linha", () => {
  const source = readFileSync("src/components/territory-card.tsx", "utf8");

  assert.match(source, /function territoryNameFontSize/);
  assert.match(source, /Array\.from\(name\.trim\(\)\)\.length/);
  assert.match(source, /fontSize: `\$\{territoryNameSize\}px`/);
  assert.match(source, /whiteSpace: "nowrap"/);
});

test("visibilidade de tropas é persistente e independente das estradas", () => {
  const source = readFileSync(
    "src/components/road-visibility-provider.tsx",
    "utf8",
  );

  assert.match(source, /war-brasil:troops-visible/);
  assert.match(source, /TroopVisibilityContext/);
  assert.match(source, /useTroopVisibility/);
  assert.match(source, /className="game-troop-toggle"/);
});

test("números de tropas usam os anchors internos calculados do mapa", () => {
  const board = readFileSync("src/components/interactive-board.tsx", "utf8");
  const anchors = readFileSync("src/components/territory-arrow.tsx", "utf8");

  assert.match(board, /useTroopVisibility/);
  assert.match(board, /anchors\.get\(territory\.territoryId\)/);
  assert.match(board, /className="game-troop-layer/);
  assert.match(board, /\{territory\.troops\}/);
  assert.match(anchors, /isPointInFill/);
  assert.match(anchors, /clearanceFromBoundary/);
  assert.match(anchors, /const divisions = 17/);
});
