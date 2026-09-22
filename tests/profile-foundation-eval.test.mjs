import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

const foundationEval = source(
  "src/components/pre-game/foundation/eval-fixtures.ts",
);
const profileShell = source("src/components/profile/v4/profile-shell.tsx");
const routeIntent = source(
  "src/components/pre-game/foundation/pre-game-route-intent.ts",
);

test("PROFILE V4 usa somente intenção semântica da Foundation", () => {
  assert.match(foundationEval, /profile:\s*\{[\s\S]*?mode: "profile"/);
  assert.match(foundationEval, /profile:\s*\{[\s\S]*?focus: "insignia"/);
  assert.match(routeIntent, /"\/profile": "profile"/);
  assert.match(routeIntent, /startsWith\("\/profile\/"\)/);
  assert.match(profileShell, /useCommandSceneDirective\(SCENE_DIRECTIVES\[activeSurface\]\)/);
  assert.match(profileShell, /dossier:\s*\{[\s\S]*?focus: "insignia"/);
  assert.match(profileShell, /arsenal:\s*\{[\s\S]*?focus: "table"/);
  assert.match(profileShell, /store:\s*\{[\s\S]*?focus: "table"/);
  assert.doesNotMatch(profileShell, /\bmode\s*:/);
  assert.doesNotMatch(profileShell, /@react-three\/fiber|command-scene-canvas|\bthree\b|Canvas|cameraPosition|\bfov\b/i);
});

test("matriz visual canônica cobre desktop e mobile normativos da PROFILE", () => {
  assert.match(foundationEval, /mobile: \{ width: 390, height: 844 \}/);
  assert.match(foundationEval, /desktop: \{ width: 1440, height: 900 \}/);
});

test("Foundation mantém reduced-motion e fallback como estados de ambiente", () => {
  assert.match(foundationEval, /"reduced-motion"/);
  assert.match(foundationEval, /"fallback"/);
});
