import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("mão mobile usa drawer dedicado somente durante a partida", () => {
  const client = source("src/components/game-client-v2.tsx");

  assert.match(client, /MobileCardHandDrawer/);
  assert.match(client, /snapshot\.room\.status === "playing"/);
  assert.match(client, /<MobileCardHandDrawer cards=\{snapshot\.myCards\}/);
});

test("drawer mantém apenas um pequeno peek fechado e move o hub pela altura revelada", () => {
  const component = source("src/components/mobile-card-hand-drawer.tsx");
  const css = source("src/app/game/[roomId]/game-mobile-hand.css");

  assert.match(component, /const CLOSED_PEEK_PX = 16/);
  assert.match(component, /--game-hand-visible-height/);
  assert.match(css, /bottom:\s*var\(--game-hand-visible-height\)/);
  assert.match(css, /height:\s*var\(--game-hand-visible-height\)/);
  assert.match(css, /display:\s*none\s*!important/);
});

test("gesto vertical usa Pointer Events com snap e não interfere no pan horizontal das cartas", () => {
  const component = source("src/components/mobile-card-hand-drawer.tsx");
  const css = source("src/app/game/[roomId]/game-mobile-hand.css");

  assert.match(component, /setPointerCapture/);
  assert.match(component, /releasePointerCapture/);
  assert.match(component, /onPointerDown=\{onPointerDown\}/);
  assert.match(component, /onPointerMove=\{onPointerMove\}/);
  assert.match(component, /DRAG_DISTANCE_THRESHOLD_PX = 36/);
  assert.match(component, /DRAG_VELOCITY_THRESHOLD = 0\.35/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /touch-action:\s*pan-x/);
});

test("drawer mede apenas a altura fechada para a área segura do mapa", () => {
  const component = source("src/components/mobile-card-hand-drawer.tsx");
  const css = source("src/app/game/[roomId]/game-mobile-hand.css");

  assert.match(component, /--game-command-closed-height/);
  assert.match(component, /getBoundingClientRect\(\)\.height/);
  assert.match(css, /--game-map-safe-bottom:[\s\S]*--game-command-closed-height/);
  assert.match(css, /max-height:[\s\S]*100dvh[\s\S]*--game-hand-visible-height/);
});

test("drawer oferece alternativa por toque e respeita redução de movimento", () => {
  const component = source("src/components/mobile-card-hand-drawer.tsx");
  const css = source("src/app/game/[roomId]/game-mobile-hand.css");

  assert.match(component, /aria-expanded=\{expanded\}/);
  assert.match(component, /aria-controls="mobile-player-card-hand"/);
  assert.match(component, /Mostrar suas cartas/);
  assert.match(component, /Recolher suas cartas/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /transition:\s*none\s*!important/);
});
