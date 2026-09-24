import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Lobby E2E respects the Profile V4 scene boundary instead of requiring Foundation persistence through Profile", () => {
  const lobby = readFileSync("scripts/e2e/lobby-e2e.mjs", "utf8");
  const runtime = readFileSync(
    "src/components/pre-game/foundation/pre-game-command-runtime.tsx",
    "utf8",
  );

  assert.match(runtime, /profileOwnsSurface \? \(/);
  assert.match(
    lobby,
    /Profile V4 deve possuir a própria viewport fora do CommandShell/,
  );
  assert.match(
    lobby,
    /locator\("\[data-command-scene-mode\]"\)\.count\(\)/,
  );
  assert.match(lobby, /foundation-remounted-after-profile/);
  assert.match(
    lobby,
    /createActor\(browser, \{ disableWebgl: true \}\)/,
  );
});
