import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const board = readFileSync("src/components/interactive-board.tsx", "utf8");
const gameClient = readFileSync("src/components/game-client-v2.tsx", "utf8");
const zoom = readFileSync("src/components/map-zoom-controller.tsx", "utf8");
const runtimeEvents = readFileSync(
  "src/lib/client/map/map-runtime-events.ts",
  "utf8",
);
const hitGeometry = readFileSync(
  "src/lib/client/map/territory-hit-geometry.ts",
  "utf8",
);
const hitInteractionState = readFileSync(
  "src/lib/client/map/territory-hit-interaction-state.ts",
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
const testConfig = readFileSync("tsconfig.test.json", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const page = readFileSync("src/app/game/[roomId]/page.tsx", "utf8");
const polish = readFileSync("src/app/game/[roomId]/map-25d-polish.css", "utf8");
const svg = readFileSync("public/mapa-war-brasil-25d.svg", "utf8");

test("zoom compensates one inherited static territory stroke", () => {
  assert.match(visualState, /--territory-render-stroke-width/);
  assert.match(zoom, /TERRITORY_BASE_STROKE = 0\.9/);
  assert.match(zoom, /TERRITORY_RENDER_STROKE_PROPERTY/);
  assert.match(zoom, /let lastRenderedStroke: number \| null = null/);
  assert.match(
    zoom,
    /territoryRoot\.style\.setProperty\([\s\S]*?TERRITORY_RENDER_STROKE_PROPERTY/,
  );
  assert.match(
    zoom,
    /territoryRoot\.style\.removeProperty\(TERRITORY_RENDER_STROKE_PROPERTY\)/,
  );
  assert.doesNotMatch(zoom, /getComputedStyle\(path\)/);
  assert.doesNotMatch(zoom, /strokeObserver/);
});

test("visual readiness is an explicit event instead of a class timing hack", () => {
  assert.match(runtimeEvents, /MAP_VISUALS_READY_EVENT/);
  assert.match(board, /surface\.dispatchEvent\(new CustomEvent\(MAP_VISUALS_READY_EVENT\)\)/);
  assert.match(zoom, /surface\.addEventListener\(MAP_VISUALS_READY_EVENT, onVisualsReady\)/);
  assert.doesNotMatch(visualState, /RUNTIME_READY_CLASS/);
});

test("gesture state is explicit and no synthetic pointerout is dispatched", () => {
  assert.match(runtimeEvents, /MAP_GESTURE_STATE_EVENT/);
  assert.match(runtimeEvents, /kind: MapGestureKind/);
  assert.match(zoom, /setGestureActive\(true, "pinch"\)/);
  assert.match(zoom, /setGestureActive\(true, "pan"\)/);
  assert.match(board, /surface\.addEventListener\(MAP_GESTURE_STATE_EVENT, gestureState\)/);
  assert.doesNotMatch(zoom, /createEvent\("Event"\)/);
  assert.doesNotMatch(zoom, /dispatchEvent\(leaveEvent\)/);
});

test("opening presentation has one renderer and a boundary-driven scheduler", () => {
  assert.match(gameClient, /presentation=\{boardPresentation\}/);
  assert.match(gameClient, /nextInitialTerritoryPresentationWakeAt/);
  assert.match(gameClient, /presentationIdentityRef/);
  assert.match(gameClient, /setPresentationClockMs\(nowMs\)/);
  assert.doesNotMatch(gameClient, /InitialTerritoryDrawPresentation/);
  assert.doesNotMatch(gameClient, /setInterval\(/);
  assert.doesNotMatch(runtimeEvents, /MAP_BOARD_PRESENTATION_EVENT/);
  assert.match(board, /const effectivePresentation = presentation/);
  assert.doesNotMatch(board, /runtimePresentation/);
  assert.match(board, /neutralTerritoryMaterial/);
  assert.match(board, /openingHighlight/);
  assert.match(board, /data-initial-territory-title/);
  assert.match(board, /!presentationActive && roadsVisible/);
  assert.match(board, /!presentationActive && troopsVisible/);
});

test("opening presentation disables pointer and keyboard hit targets", () => {
  assert.match(hitInteractionState, /setTerritoryHitInteractionEnabled/);
  assert.match(hitInteractionState, /path\.style\.pointerEvents = enabled \? "fill" : "none"/);
  assert.match(hitInteractionState, /path\.setAttribute\("tabindex", enabled \? "0" : "-1"\)/);
  assert.match(hitInteractionState, /path\.setAttribute\("aria-disabled", "true"\)/);
  assert.match(hitInteractionState, /path\.ownerDocument\.activeElement === path/);
  assert.match(hitInteractionState, /focusablePath\.blur\?\.\(\)/);
  assert.match(board, /setTerritoryHitInteractionEnabled\(root, !presentationActive\)/);
  assert.match(
    board,
    /setTerritoryHitInteractionEnabled\(root, !presentationIsActive\(\)\)/,
  );
  assert.doesNotMatch(board, /interactionEnabledRef/);
  assert.match(polish, /data-map-presentation-active="true"/);
  assert.match(polish, /pointer-events: none/);
});

test("interaction reuses canonical face geometry instead of generating a hit layer", () => {
  assert.match(hitGeometry, /export function buildTerritoryHitLayer/);
  assert.match(hitGeometry, /face\.dataset\.territoryHit = "true"/);
  assert.match(hitGeometry, /face\.style\.pointerEvents = "fill"/);
  assert.match(hitGeometry, /depth\.style\.pointerEvents = "none"/);
  assert.doesNotMatch(hitGeometry, /resolveHitPolygonPath/);
  assert.doesNotMatch(hitGeometry, /safeInsetPolygonPath/);
  assert.doesNotMatch(hitGeometry, /safeScaledPolygonPath/);
  assert.doesNotMatch(hitGeometry, /createElementNS\(/);
  assert.match(board, /buildTerritoryHitLayer\(mapDocument, root, nextVisualNodes\)/);
});

test("registry ainda valida integralmente o contrato visual dos 42 territórios", () => {
  assert.match(nodes, /EXPECTED_TERRITORY_COUNT = 42/);
  assert.match(nodes, /EXPECTED_FACE_STOPS = 5/);
  assert.match(nodes, /EXPECTED_SIDE_STOPS = 3/);
  assert.match(nodes, /EXPECTED_DEPTH_LAYERS = \[1, 2, 3, 4\]/);
  assert.match(nodes, /validateTerritoryVisualRegistry/);
});

test("test compile inclui os módulos client do mapa 2.5d", () => {
  for (const file of [
    "board-presentation.ts",
    "map-runtime-events.ts",
    "territory-hit-geometry.ts",
    "territory-hit-interaction-state.ts",
    "territory-material.ts",
    "territory-svg-nodes.ts",
    "territory-svg-interaction.ts",
    "territory-visual-state.ts",
  ]) {
    assert.match(testConfig, new RegExp(file.replace(".", "\\.")));
  }
});

test("tokens de tropas respeitam o inset visual e a safeRadius", () => {
  assert.match(board, /geometry\.safeRadius - topInset/);
  assert.match(board, /desktopTroopMarkerRadius/);
  assert.match(board, /mobileTroopMarkerRadius/);
  assert.match(board, /MAP_WORLD_SIZE/);
});

test("polimento 2.5d fica restrito à rota do jogo", () => {
  assert.doesNotMatch(layout, /map-25d-polish\.css/);
  assert.match(page, /import "\.\/map-25d-polish\.css"/);
  assert.match(polish, /\.game-map-surface/);
  assert.match(polish, /data-map-gesture-active/);
  assert.match(polish, /will-change: auto/);
});

test("gestos móveis continuam protegendo seleção acidental", () => {
  assert.match(zoom, /CLICK_SUPPRESSION_MS = 450/);
  assert.match(zoom, /suppressSelection\(\)/);
  assert.match(zoom, /svg\.addEventListener\("click", onClickCapture, true\)/);
  assert.match(zoom, /event\.stopImmediatePropagation\(\)/);
});

test("hover cleanup is stable under react hook linting", () => {
  assert.match(board, /useCallback/);
  assert.match(board, /const clearHoveredTerritory = useCallback/);
  assert.match(board, /\[clearHoveredTerritory, presentationActive\]/);
});

test("polimento não altera geometria canônica do mapa", () => {
  assert.match(svg, /viewBox="0 0 1254 1254"/);
  assert.match(svg, /data-layout="2\.5d-premium-v2"/);
  assert.match(svg, /data-territory-id="40"/);
  assert.match(board, /territoryGeometryFromPath\(path\)/);
});
