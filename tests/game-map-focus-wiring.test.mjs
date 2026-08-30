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
const zoomCssSource = readFileSync(
  new URL("../src/app/game/[roomId]/game-map-zoom.css", import.meta.url),
  "utf8",
);

test("board publishes stable focus ids derived from the current interaction context", () => {
  assert.match(boardSource, /deriveMapFocusTerritoryIds/);
  assert.match(boardSource, /interactionMode: GamePhase/);
  assert.match(boardSource, /data-map-focus-ids=\{focusTerritoryIds\.join\(","\)\}/);
  assert.match(clientSource, /interactionMode=\{snapshot\.room\.phase\}/);
});

test("zoom controller fits cached SVG territory bounds through the existing viewport pipeline", () => {
  assert.match(zoomSource, /territoryBoundsById/);
  assert.match(zoomSource, /cacheTerritoryBounds/);
  assert.match(zoomSource, /path\.getBBox\(\)/);
  assert.match(zoomSource, /unionMapBounds\(boxes\)/);
  assert.match(zoomSource, /fitMapViewportToBounds\(/);
  assert.match(zoomSource, /applyViewport\(/);
  assert.match(zoomSource, /attributeFilter: \["data-map-focus-ids"\]/);
});

test("autofocus animates through the existing viewport and yields immediately to touch", () => {
  assert.match(zoomSource, /MAP_AUTO_FOCUS_DURATION_MS/);
  assert.match(zoomSource, /requestAnimationFrame\(step\)/);
  assert.match(zoomSource, /cancelAnimationFrame\(autoFocusFrame\)/);
  assert.match(zoomSource, /prefers-reduced-motion: reduce/);
  assert.match(
    zoomSource,
    /const onPointerDown[\s\S]*?cancelAutoFocusAnimation\(\)/,
  );
});

test("mobile reset control returns to the full map without letting the same focus steal the camera back", () => {
  assert.match(zoomSource, /game-map-reset-control/);
  assert.match(zoomSource, /aria-label", "Mostrar mapa inteiro"/);
  assert.match(
    zoomSource,
    /const resetMapViewport[\s\S]*?manualViewportOverride = true;[\s\S]*?DEFAULT_MAP_VIEWPORT/,
  );
  assert.match(
    zoomSource,
    /if \(focusChanged\) \{[\s\S]*?manualViewportOverride = false;[\s\S]*?\} else if \(manualViewportOverride\)/,
  );
  assert.match(
    zoomSource,
    /mobile && autoFocusActive && !manualViewportOverride/,
  );
  assert.match(
    zoomCssSource,
    /data-map-zoomed="true"\] > \.game-map-reset-control/,
  );
  assert.match(zoomCssSource, /width: 44px;/);
  assert.match(zoomCssSource, /height: 44px;/);
});

test("manual pinch and pan take ownership of the viewport until focus changes", () => {
  assert.match(
    zoomSource,
    /const startPinch[\s\S]*?manualViewportOverride = true;/,
  );
  assert.match(
    zoomSource,
    /if \(viewport\.scale <= MAP_MIN_SCALE \+ 0\.001\) return;[\s\S]*?manualViewportOverride = true;/,
  );
});

test("resize and SVG reload reapply focus without running another camera animation", () => {
  const instantReapplyCount = (
    zoomSource.match(/force: true, animated: false/g) ?? []
  ).length;
  assert.ok(instantReapplyCount >= 3);
});

test("animation frames never read SVG geometry", () => {
  const animationStart = zoomSource.indexOf("const animateViewportTo");
  const cacheStart = zoomSource.indexOf("const cacheTerritoryBounds");
  assert.ok(animationStart >= 0);
  assert.ok(cacheStart > animationStart);
  const animationSource = zoomSource.slice(animationStart, cacheStart);
  assert.doesNotMatch(animationSource, /getBBox\(/);
  assert.doesNotMatch(animationSource, /querySelector/);
});

test("autofocus remains frontend-only and does not introduce game commands", () => {
  assert.doesNotMatch(zoomSource, /runGameCommand|fetch\(/);
  assert.doesNotMatch(boardSource, /runGameCommand|fetch\(/);
});
