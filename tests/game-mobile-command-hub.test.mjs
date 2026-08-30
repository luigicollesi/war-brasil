import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controllerSource = readFileSync(
  new URL("../src/components/mobile-command-hub-controller.tsx", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../src/app/game/[roomId]/page.tsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(
  new URL("../src/app/game/[roomId]/game-mobile-command.css", import.meta.url),
  "utf8",
);

test("game page mounts the mobile command hub controller and stylesheet", () => {
  assert.match(pageSource, /MobileCommandHubController/);
  assert.match(pageSource, /<MobileCommandHubController \/>/);
  assert.match(pageSource, /game-mobile-command\.css/);
});

test("command hub reuses the existing panel without changing game actions", () => {
  assert.match(controllerSource, /\.game-map-canvas \+ section/);
  assert.match(controllerSource, /classList\.add\("game-command-hub"\)/);
  assert.doesNotMatch(controllerSource, /runGameCommand|fetch\(/);
});

test("vertical drag continuously changes the visible command height", () => {
  assert.match(controllerSource, /setPointerCapture\(event\.pointerId\)/);
  assert.match(controllerSource, /const deltaUp = drag\.startY - event\.clientY/);
  assert.match(controllerSource, /setVisibleHeight\(drag\.startHeight \+ deltaUp\)/);
  assert.match(controllerSource, /--game-command-visible-height/);
  assert.match(controllerSource, /DRAG_DISTANCE_THRESHOLD_PX = 36/);
  assert.match(controllerSource, /DRAG_VELOCITY_THRESHOLD = 0\.35/);
});

test("drawer measures expanded content even while visually collapsed", () => {
  assert.match(controllerSource, /const measureExpandedHeight = \(\) =>/);
  assert.match(controllerSource, /previousOpenState = hub\.dataset\.open/);
  assert.match(controllerSource, /if \(needsExpandedMeasurement\) hub\.dataset\.open = "true"/);
  assert.match(controllerSource, /Math\.ceil\(hub\.scrollHeight\)/);
  assert.match(controllerSource, /hub\.dataset\.open = previousOpenState/);
  assert.match(controllerSource, /if \(nextExpanded\) measureExpandedHeight\(\)/);
  assert.match(controllerSource, /if \(!expanded\) measureExpandedHeight\(\)/);
});

test("drawer keeps a compact peek and lets expanded height follow the mobile viewport", () => {
  assert.match(controllerSource, /COLLAPSED_HEIGHT_PX = 72/);
  assert.match(controllerSource, /MAX_EXPANDED_VIEWPORT_RATIO = 0\.42/);
  assert.doesNotMatch(controllerSource, /MAX_EXPANDED_HEIGHT_PX/);
  assert.match(controllerSource, /window\.innerHeight \* MAX_EXPANDED_VIEWPORT_RATIO/);
  assert.match(controllerSource, /delta > 0/);
  assert.match(controllerSource, /setVisibleHeight\(expanded \? expandedHeight : COLLAPSED_HEIGHT_PX\)/);
});

test("content changes can refresh expanded height without observing drawer state attributes", () => {
  assert.match(controllerSource, /attributes: true/);
  assert.match(controllerSource, /attributeFilter: \["class", "style"\]/);
  assert.match(controllerSource, /characterData: true/);
  assert.doesNotMatch(controllerSource, /attributeFilter:[\s\S]*data-open/);
});

test("map safe area follows the command drawer height without the old 298px ceiling", () => {
  assert.match(cssSource, /--game-command-visible-height: 190px/);
  assert.match(
    cssSource,
    /--game-map-safe-bottom:[\s\S]*?var\(--game-command-visible-height\)/,
  );
  assert.match(cssSource, /calc\(42dvh \+ 12px\)/);
  assert.match(cssSource, /height: var\(--game-command-visible-height\) !important/);
  assert.match(
    cssSource,
    /\.game-map-canvas \+ section\.game-command-hub[\s\S]*?max-height: none !important/,
  );
  assert.match(cssSource, /\.game-map-surface[\s\S]*?width 220ms/);
});

test("dragging disables layout transitions and reduced motion stays instant", () => {
  assert.match(controllerSource, /mobileCommandDragging/);
  assert.match(
    cssSource,
    /data-mobile-command-dragging="true"[\s\S]*?transition: none !important/,
  );
  assert.match(cssSource, /prefers-reduced-motion: reduce/);
});

test("handle remains touch-friendly and supports tap toggling", () => {
  assert.match(cssSource, /\.mobile-command-hub-handle[\s\S]*?width: 88px/);
  assert.match(cssSource, /height: 46px/);
  assert.match(cssSource, /touch-action: none/);
  assert.match(controllerSource, /settle\(!expanded\)/);
  assert.match(controllerSource, /aria-expanded/);
});
