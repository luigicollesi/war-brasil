import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const helper = readFileSync("scripts/e2e/runtime-helper.mjs", "utf8");
const migrated = [
  "scripts/e2e/auth-credentials-verification-e2e.mjs",
  "scripts/e2e/lobby-e2e.mjs",
  "scripts/e2e/store-showcase-e2e.mjs",
  "scripts/e2e/economy-purchase-e2e.mjs",
];

test("E2E reutiliza loader Playwright e cliente JSON sem duplicar implementação", () => {
  assert.match(helper, /export async function loadPlaywrightRuntime/);
  assert.match(helper, /PLAYWRIGHT_RUNTIME_DIR/);
  assert.match(helper, /export async function apiJson/);
  assert.match(helper, /page\.evaluate/);

  for (const path of migrated) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /from "\.\/runtime-helper\.mjs"/, path);
    assert.doesNotMatch(source, /async function apiJson\(/, path);
    assert.doesNotMatch(source, /pathToFileURL\(/, path);
  }
});
