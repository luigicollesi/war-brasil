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

test("combate separa cinematic 3D do resultado SVG estático", () => {
  const overlay = readFileSync("src/components/battle-overlay.tsx", "utf8");
  const cinematic = readFileSync(
    "src/components/dice-3d/battle-dice-cinematic.tsx",
    "utf8",
  );
  const staticResults = readFileSync(
    "src/components/battle-static-dice-results.tsx",
    "utf8",
  );
  const die = readFileSync("src/components/game-die.tsx", "utf8");

  assert.match(overlay, /BattleDiceCinematic/);
  assert.match(overlay, /BattleStaticDiceResults/);
  assert.doesNotMatch(overlay, /BattleDiceArena/);
  assert.match(cinematic, /createPortal/);
  assert.match(cinematic, /skin: side/);
  assert.match(cinematic, /pipColor: playerColorHex\(color\)/);
  assert.match(staticResults, /<GameDie/);
  assert.doesNotMatch(staticResults, /rolling=/);
  assert.doesNotMatch(staticResults, /rollAnimation=/);
  assert.match(die, /backgroundColor: playerColorHex\(color\)/);
});

test("cinematic de combate deriva apresentação do stage e bloqueia toda interação", () => {
  const overlay = readFileSync("src/components/battle-overlay.tsx", "utf8");
  const cinematic = readFileSync(
    "src/components/dice-3d/battle-dice-cinematic.tsx",
    "utf8",
  );
  const styles = readFileSync(
    "src/components/dice-3d/battle-dice-cinematic.module.css",
    "utf8",
  );

  assert.match(overlay, /battleCinematicSide\(battle\)/);
  assert.match(overlay, /cinematicPresentationId !== completedPresentationId/);
  assert.doesNotMatch(overlay, /setCinematicPresentation/);
  assert.match(overlay, /setAttribute\("inert", ""\)/);
  assert.match(overlay, /removeAttribute\("inert"\)/);
  assert.match(cinematic, /frameloop="demand"/);
  assert.match(cinematic, /BATTLE_DICE_CINEMATIC_TOTAL_MS - initialElapsedMs/);
  assert.match(cinematic, /MIN_PRESENTATION_REMAINING_MS/);
  assert.doesNotMatch(cinematic, /dockPositions=/);
  assert.doesNotMatch(cinematic, /dockScale=/);
  assert.match(styles, /position: fixed/);
  assert.match(styles, /inset: 0/);
  assert.match(styles, /background: rgba\(0, 0, 0, 0\.1\)/);
  assert.match(styles, /touch-action: none/);
});

test("cinematic sincroniza frame inicial e adapta enquadramento para portrait", () => {
  const cinematic = readFileSync(
    "src/components/dice-3d/battle-dice-cinematic.tsx",
    "utf8",
  );
  const predetermined = readFileSync(
    "src/components/dice-3d/predetermined-dice-roll.tsx",
    "utf8",
  );
  const replay = readFileSync(
    "src/components/dice-3d/dice-trajectory-replay.tsx",
    "utf8",
  );

  assert.match(cinematic, /Date\.now\(\) - startedAtMs/);
  assert.match(cinematic, /initialElapsedMs=\{Math\.min/);
  assert.match(cinematic, /<perspectiveCamera/);
  assert.match(cinematic, /set\(\{ camera \}\)/);
  assert.match(cinematic, /PORTRAIT_ASPECT_THRESHOLD/);
  assert.match(cinematic, /portrait \? Math\.PI \/ 2 : 0/);
  assert.match(cinematic, /position=\{position\}/);
  assert.match(cinematic, /planeGeometry args=\{\[6\.4, 6\.4\]\}/);
  assert.match(predetermined, /initialElapsedMs=\{initialElapsedMs\}/);
  assert.match(replay, /initialElapsedMs = 0/);
  assert.match(replay, /sampleTrajectoryState/);
  assert.match(replay, /elapsedSeconds = useRef\(initialReplaySeconds\)/);
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
