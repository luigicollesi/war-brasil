import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("interação deriva alvos especiais das regras puras e do roteador", () => {
  const interaction = source("src/lib/game-interaction.ts");

  assert.match(interaction, /attackProfile/);
  assert.match(interaction, /bestTerritoryRoutes/);
  assert.match(interaction, /maneuverTraversalProfile/);
  assert.match(interaction, /kind: "barrier-attack"/);
  assert.match(interaction, /kind: "barrier-maneuver"/);
  assert.doesNotMatch(interaction, /reachableTerritoryIds/);
});

test("hook decide cliques pelos MapTargetHints sem reimplementar passabilidade", () => {
  const hook = source("src/hooks/use-game-interaction.ts");

  assert.match(hook, /mapHints\.targets\.find/);
  assert.match(hook, /maneuverTraversalFromTarget/);
  assert.match(hook, /targetHint\.selectable/);
  assert.doesNotMatch(hook, /connection\.passable/);
  assert.doesNotMatch(hook, /findTerritoryConnection/);
});

test("mapa usa TerritoryGeometry e uma camada única para caveira e alçapão", () => {
  const board = source("src/components/interactive-board.tsx");
  const markers = source("src/components/territory-special-markers.tsx");

  assert.match(board, /territoryGeometryFromPath\(path\)/);
  assert.match(board, /Map<number, TerritoryGeometry>/);
  assert.match(board, /<TerritorySpecialMarkers/);
  assert.match(board, /specialMarkerIds\.has\(territory\.territoryId\)/);
  assert.match(markers, /fitTerritoryMarkerSize/);
  assert.match(markers, /caveira-vermelha\.svg/);
  assert.match(markers, /alcapao-saida\.svg/);
  assert.match(markers, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(markers, /pointer-events-none/);
});

test("board permanece camada de apresentação e não calcula regras de jogo", () => {
  const board = source("src/components/interactive-board.tsx");

  assert.doesNotMatch(board, /attackProfile/);
  assert.doesNotMatch(board, /bestTerritoryRoute/);
  assert.doesNotMatch(board, /maneuverTraversalProfile/);
});

test("diálogo de manobra respeita mínimo, perda e chegada definidos pela travessia", () => {
  const panel = source("src/components/game-turn-panel.tsx");

  assert.match(panel, /maneuverTraversal\?\.minimumTroops \?\? 1/);
  assert.match(panel, /maneuverTraversal\.troopLoss/);
  assert.match(panel, /const arriving = count - maneuverLoss/);
  assert.match(panel, /targetBefore \+ arriving/);
  assert.match(panel, /MOVER \$\{count\} · \$\{arriving\} CHEGAM/);
  assert.match(panel, /min=\{minimum\}/);
  assert.match(panel, /maneuverTraversal=\{localDialog\.traversal\}/);
});
