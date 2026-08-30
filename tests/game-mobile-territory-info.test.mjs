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

test("mobile territory info keeps the current vertical anchor under the turn order", () => {
  assert.match(controllerSource, /ORDER_LABEL = "Ordem de jogo"/);
  assert.match(controllerSource, /getBoundingClientRect\(\)/);
  assert.match(
    controllerSource,
    /overlay\.style\.top = `\$\{Math\.round\(rect\.bottom\)\}px`/,
  );
  assert.match(controllerSource, /ResizeObserver\(schedulePosition\)/);
  assert.doesNotMatch(controllerSource, /overlay\.style\.width/);
  assert.doesNotMatch(controllerSource, /overlay\.style\.left/);
});

test("mobile territory info mirrors hover lifetime instead of retaining the last territory", () => {
  assert.match(controllerSource, /\.game-territory-tooltip/);
  assert.match(controllerSource, /overlay\.innerHTML = source\.innerHTML/);
  assert.match(controllerSource, /const hideOverlay = \(\) =>/);
  assert.match(
    controllerSource,
    /if \(!source\) \{\s*hideOverlay\(\);\s*return;/,
  );
  assert.doesNotMatch(controllerSource, /hasMobileInfo/);
});

test("mobile territory info is compact, centered and transparent to touch", () => {
  assert.match(
    cssSource,
    /\.mobile-territory-info-layer \{[\s\S]*?position: fixed;[\s\S]*?left: 50%;/,
  );
  assert.match(cssSource, /width: max-content;/);
  assert.match(cssSource, /min-width: 180px;/);
  assert.match(cssSource, /max-width: min\(260px, calc\(100vw - 24px\)\);/);
  assert.match(cssSource, /border-radius: 13px;/);
  assert.match(cssSource, /translateX\(-50%\)/);
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
  assert.match(boardSource, /setHoveredTerritory\(null\)/);
  assert.match(cssSource, /@media \(max-width: 767px\)/);
});
