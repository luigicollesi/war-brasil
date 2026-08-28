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
  const polish = readFileSync("src/app/game/[roomId]/game-polish.css", "utf8");

  assert.match(overlay, /backgroundColor: colorHex\(color\)/);
  assert.doesNotMatch(polish, /background-color:\s*#f8f0dc\s*!important/);
  assert.match(polish, /A cor dos pips vem do jogador/);
});

test("rolagem de defesa mantém os dados de ataque estáticos", () => {
  const overlay = readFileSync("src/components/battle-overlay.tsx", "utf8");
  const polish = readFileSync("src/app/game/[roomId]/game-polish.css", "utf8");

  assert.match(overlay, /battle\.stage === "show_defender_result"/);
  assert.match(polish, /section:has\(> button\)/);
  assert.match(polish, /:has\(> div:nth-child\(2\)\)/);
  assert.match(polish, /> div:first-child \.dice-roll-animation/);
  assert.match(polish, /animation: none !important/);
  assert.match(polish, /transform: none !important/);
});
