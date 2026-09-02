import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("filtro 3D suprime somente depreciações conhecidas das dependências", () => {
  const filter = source(
    "src/lib/client/dice/install-3d-dependency-warning-filter.ts",
  );

  assert.match(
    filter,
    /using deprecated parameters for the initialization function; pass a single object instead/,
  );
  assert.match(
    filter,
    /THREE\.Clock: This module has been deprecated\. Please use THREE\.Timer instead\./,
  );
  assert.match(filter, /getConsoleFunction/);
  assert.match(filter, /setConsoleFunction/);
  assert.match(filter, /args\[0\] === RAPPIER_WASM_INIT_WARNING/);
  assert.match(filter, /message === THREE_CLOCK_WARNING/);
  assert.match(filter, /originalWarn\(\.\.\.args\)/);
  assert.match(filter, /previousThreeConsole\(type, message, \.\.\.params\)/);
  assert.doesNotMatch(filter, /console\.warn\s*=\s*\(\)\s*=>/);
});

test("todos os Canvas de dados instalam o filtro antes da apresentação", () => {
  const fullscreen = source(
    "src/components/dice-3d/fullscreen-dice-cinematic.tsx",
  );
  const scene = source("src/components/dice-3d/dice-scene.tsx");

  for (const component of [fullscreen, scene]) {
    assert.match(component, /installDice3DDependencyWarningFilter/);
    assert.match(component, /installDice3DDependencyWarningFilter\(\);/);
  }
});
