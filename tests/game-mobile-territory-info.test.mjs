import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controllerSource = readFileSync(
  new URL("../src/components/mobile-territory-info-controller.tsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(
  new URL("../src/app/game/[roomId]/game-mobile-territory-info.css", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../src/app/game/[roomId]/page.tsx", import.meta.url),
  "utf8",
);
const boardSource = readFileSync(
  new URL("../src/components/interactive-board.tsx", import.meta.url),
  "utf8",
);

test("game page mounts the mobile territory info controller and stylesheet", () => {
  assert.match(pageSource, /MobileTerritoryInfoController/);
  assert.match(pageSource, /game-mobile-territory-info\.css/);
});

test("mobile territory info anchors directly to the measured turn order strip", () => {
  assert.match(controllerSource, /ORDER_LABEL = "Ordem de jogo"/);
  assert.match(controllerSource, /getBoundingClientRect\(\)/);
  assert.match(controllerSource, /overlay\.style\.top = `\$\{Math\.round\(rect\.bottom\)\}px`/);
  assert.match(controllerSource, /overlay\.style\.left/);
  assert.match(controllerSource, /overlay\.style\.width/);
  assert.match(controllerSource, /ResizeObserver\(schedulePosition\)/);
});

test("mobile territory info copies existing tooltip content and keeps the last touch-visible information", () => {
  assert.match(controllerSource, /\.game-territory-tooltip/);
  assert.match(controllerSource, /overlay\.innerHTML = source\.innerHTML/);
  assert.match(controllerSource, /hasMobileInfo = true/);
  assert.match(
    controllerSource,
    /overlay\.dataset\.visible = hasMobileInfo \? "true" : "false"/,
  );
});

test("floating territory info is fixed above the map and completely transparent to touch", () => {
  assert.match(cssSource, /\.mobile-territory-info-layer \{[\s\S]*?position: fixed;/);
  assert.match(cssSource, /z-index: 45;/);
  assert.match(cssSource, /\.game-turn-order-strip-anchor \{[\s\S]*?z-index: 46/);
  assert.match(cssSource, /pointer-events: none !important;/);
  assert.match(
    cssSource,
    /\.mobile-territory-info-layer \*[\s\S]*?pointer-events: none !important;/,
  );
});

test("mobile territory info never reserves map or command hub layout space", () => {
  assert.doesNotMatch(cssSource, /--game-map-safe-(?:top|bottom)/);
  assert.doesNotMatch(cssSource, /--game-command-visible-height/);
  assert.doesNotMatch(cssSource, /--game-hand-visible-height/);
  assert.doesNotMatch(controllerSource, /style\.setProperty/);
});

test("desktop cursor-follow tooltip implementation remains present", () => {
  assert.match(boardSource, /scheduleTooltipPosition/);
  assert.match(boardSource, /translate3d\(\$\{x\}px, \$\{y\}px, 0\)/);
  assert.match(boardSource, /className="game-territory-tooltip"/);
  assert.match(cssSource, /@media \(max-width: 767px\)/);
});
