import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const boardSource = readFileSync(
  new URL("../src/components/interactive-board.tsx", import.meta.url),
  "utf8",
);
const clientSource = readFileSync(
  new URL("../src/components/game-client-v2.tsx", import.meta.url),
  "utf8",
);
const zoomSource = readFileSync(
  new URL("../src/components/map-zoom-controller.tsx", import.meta.url),
  "utf8",
);

test("board publishes stable focus ids derived from the current interaction context", () => {
  assert.match(boardSource, /deriveMapFocusTerritoryIds/);
  assert.match(boardSource, /interactionMode: GamePhase/);
  assert.match(boardSource, /data-map-focus-ids=\{focusTerritoryIds\.join\(","\)\}/);
  assert.match(clientSource, /interactionMode=\{snapshot\.room\.phase\}/);
});

test("zoom controller fits SVG territory bounds through the existing viewport pipeline", () => {
  assert.match(zoomSource, /data\.mapFocusIds/);
  assert.match(zoomSource, /path\.getBBox\(\)/);
  assert.match(zoomSource, /unionMapBounds\(boxes\)/);
  assert.match(zoomSource, /fitMapViewportToBounds\(/);
  assert.match(zoomSource, /applyViewport\(/);
  assert.match(zoomSource, /attributeFilter: \["data-map-focus-ids"\]/);
});

test("autofocus remains frontend-only and does not introduce game commands", () => {
  assert.doesNotMatch(zoomSource, /runGameCommand|fetch\(/);
  assert.doesNotMatch(boardSource, /runGameCommand|fetch\(/);
});
