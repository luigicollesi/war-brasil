import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("toggle de estradas permanece visível e tocável em tablet e celular", () => {
  const css = readFileSync(
    "src/app/game/[roomId]/game-roads.css",
    "utf8",
  );

  assert.match(css, /@media \(max-width: 1199px\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /env\(safe-area-inset-right/);
  assert.doesNotMatch(
    css,
    /\.game-road-toggle[^}]*display:\s*none/s,
  );
});

test("âncora territorial procura um ponto interno em vez de confiar só no bounding box", () => {
  const source = readFileSync(
    "src/components/territory-arrow.tsx",
    "utf8",
  );

  assert.match(source, /isPointInFill\(/);
  assert.match(source, /getTotalLength\(/);
  assert.match(source, /getPointAtLength\(/);
  assert.match(source, /clearanceFromBoundary\(/);
  assert.match(source, /const divisions = 17/);
  assert.match(source, /const fallbackDivisions = 33/);
});
