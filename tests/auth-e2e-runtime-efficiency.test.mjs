import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const apiOnlyAuthScenarios = [
  "scripts/e2e/auth-credentials-verification-e2e.mjs",
  "scripts/e2e/auth-password-reset-e2e.mjs",
  "scripts/e2e/auth-session-security-e2e.mjs",
  "scripts/e2e/auth-origin-redirect-e2e.mjs",
  "scripts/e2e/auth-seat-boundary-e2e.mjs",
];

test("API-only auth E2Es establish same-origin without mounting the WebGL home", () => {
  for (const path of apiOnlyAuthScenarios) {
    const source = readFileSync(path, "utf8");
    assert.match(
      source,
      /page\.goto\(\x60\$\{BASE_URL\}\/robots\.txt\x60/,
      path,
    );
    assert.doesNotMatch(
      source,
      /page\.goto\(\x60\$\{BASE_URL\}\/\x60/,
      path,
    );
    assert.doesNotMatch(
      source,
      /\.locator\(|getByRole|getByText|getByLabel|\.click\(|\.fill\(/,
      path,
    );
  }
});

test("black-box case timeout remains bounded at twenty seconds by default", () => {
  const runner = readFileSync("scripts/e2e/run-black-box-suite.mjs", "utf8");
  assert.match(runner, /BLACKBOX_CASE_TIMEOUT_MS \?\? "20000"/);
  assert.match(runner, /child\.kill\("SIGTERM"\)/);
  assert.match(runner, /child\.kill\("SIGKILL"\)/);
});
