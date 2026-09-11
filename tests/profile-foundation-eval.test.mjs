import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

const foundationEval = source(
  "src/components/pre-game/foundation/eval-fixtures.ts",
);
const profileShell = source(
  "src/components/profile/profile-command-shell.tsx",
);
const routeIntent = source(
  "src/components/pre-game/foundation/pre-game-route-intent.ts",
);

test("PROFILE usa a mesma intenção semântica do cenário profile da Foundation", () => {
  assert.match(foundationEval, /profile:\s*\{[\s\S]*?mode: "profile"/);
  assert.match(foundationEval, /profile:\s*\{[\s\S]*?focus: "insignia"/);
  assert.match(routeIntent, /"\/profile": "profile"/);
  assert.doesNotMatch(profileShell, /\bmode\s*:/);
  assert.match(profileShell, /focus: "insignia"/);
  assert.match(profileShell, /conflictLevel: 0/);
  assert.match(profileShell, /orbitalAlignment: 1/);
});

test("matriz visual canônica cobre desktop e mobile normativos da PROFILE", () => {
  assert.match(foundationEval, /mobile: \{ width: 390, height: 844 \}/);
  assert.match(foundationEval, /desktop: \{ width: 1440, height: 900 \}/);
});

test("Foundation mantém reduced-motion e fallback como estados de ambiente", () => {
  assert.match(foundationEval, /"reduced-motion"/);
  assert.match(foundationEval, /"fallback"/);
});
