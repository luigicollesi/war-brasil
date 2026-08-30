import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("nome da carta ajusta tipografia pelo número de caracteres e permanece em uma linha", () => {
  const source = readFileSync(
    "src/components/territory-card-artwork.tsx",
    "utf8",
  );
  const card = readFileSync("src/components/territory-card.tsx", "utf8");

  assert.match(source, /function territoryNameFontSize/);
  assert.match(source, /Array\.from\(name\.trim\(\)\)\.length/);
  assert.match(source, /fontSize: `\$\{territoryNameSize\}px`/);
  assert.match(source, /whiteSpace: "nowrap"/);
  assert.match(card, /TerritoryCardArtwork/);
});

test("visibilidade de tropas é persistente e o controle vive na utility bar", () => {
  const provider = readFileSync(
    "src/components/road-visibility-provider.tsx",
    "utf8",
  );
  const utility = readFileSync(
    "src/components/game-utility-bar.tsx",
    "utf8",
  );

  assert.match(provider, /war-brasil:troops-visible/);
  assert.match(provider, /GameMapVisibilityContext/);
  assert.match(provider, /toggleTroops/);
  assert.match(provider, /useTroopVisibility/);
  assert.doesNotMatch(provider, /<button/);
  assert.match(utility, /aria-pressed=\{troopsVisible\}/);
  assert.match(utility, />Tropas</);
});

test("números e símbolos especiais usam a geometria interna extraída do SVG", () => {
  const board = readFileSync("src/components/interactive-board.tsx", "utf8");
  const markers = readFileSync(
    "src/components/territory-special-markers.tsx",
    "utf8",
  );
  const arrow = readFileSync("src/components/territory-arrow.tsx", "utf8");
  const svgGeometry = readFileSync("src/lib/territory-svg-geometry.ts", "utf8");
  const geometry = readFileSync("src/lib/territory-geometry.ts", "utf8");

  assert.match(board, /useTroopVisibility/);
  assert.match(board, /territoryGeometryFromPath\(path\)/);
  assert.match(board, /geometries\.get\(territory\.territoryId\)/);
  assert.match(board, /className="game-troop-layer/);
  assert.match(board, /specialMarkerIds\.has\(territory\.territoryId\)/);
  assert.match(board, /\{territory\.troops\}/);
  assert.match(markers, /fitTerritoryMarkerSize/);
  assert.match(markers, /\/caveira-vermelha\.svg/);
  assert.match(markers, /\/alcapao-saida\.svg/);
  assert.match(markers, /pointer-events-none/);
  assert.match(arrow, /territoryGeometryFromPath\(pathElement\)/);
  assert.match(svgGeometry, /pathElement\.isPointInFill/);
  assert.match(svgGeometry, /pathElement\.getBBox\(\)/);
  assert.match(geometry, /distanceSquaredToSegment/);
  assert.match(geometry, /sampleGrid\(17\)/);
  assert.match(geometry, /safeRadius/);
});

test("pips dos dados de combate preservam a cor da facção", () => {
  const overlay = readFileSync("src/components/battle-overlay.tsx", "utf8");
  const die = readFileSync("src/components/game-die.tsx", "utf8");
  const polish = readFileSync("src/app/game/[roomId]/game-polish.css", "utf8");

  assert.match(overlay, /GameDie/);
  assert.match(die, /backgroundColor: colorHex\(color\)/);
  assert.doesNotMatch(polish, /background-color:\s*#f8f0dc\s*!important/);
  assert.match(polish, /A cor dos pips vem do jogador/);
});

test("rolagem de defesa mantém os dados de ataque estáticos por estado explícito", () => {
  const overlay = readFileSync("src/components/battle-overlay.tsx", "utf8");
  const die = readFileSync("src/components/game-die.tsx", "utf8");

  assert.match(overlay, /type BattleDisplaySide/);
  assert.match(overlay, /rollingSide === "attack"/);
  assert.match(overlay, /rollingSide === "defense"/);
  assert.match(overlay, /rolling=\{attackRolling\}/);
  assert.match(overlay, /rolling=\{defenseRolling\}/);
  assert.match(die, /battle-die-roll-animation/);
});

test("modal de combate reutiliza território carregado e nome do SVG sem nova requisição", () => {
  const overlay = readFileSync("src/components/battle-overlay.tsx", "utf8");
  const client = readFileSync("src/components/game-client-v2.tsx", "utf8");
  const refresh = readFileSync(
    "src/app/game/[roomId]/game-ui-refresh.css",
    "utf8",
  );

  assert.match(client, /territories=\{snapshot\.territories\}/);
  assert.match(overlay, /territories: GameSnapshot\["territories"\]/);
  assert.match(overlay, /\.game-map-object/);
  assert.match(overlay, /contentDocument/);
  assert.match(overlay, /path\.territory\[data-id=/);
  assert.match(overlay, /territory\.territoryId === battle\.attackerTerritoryId/);
  assert.match(overlay, /territory\.territoryId === battle\.defenderTerritoryId/);
  assert.match(overlay, /attackerTerritory\?\.troops/);
  assert.match(overlay, /defenderTerritory\?\.troops/);
  assert.doesNotMatch(overlay, /fetch\(/);
  assert.match(refresh, /\.battle-context/);
  assert.match(refresh, /\.battle-participant--defense/);
  assert.match(refresh, /width: clamp\(32px, 10vw, 44px\) !important/);
});
