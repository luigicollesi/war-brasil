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

test("black-box timeout stays at twenty seconds per normal case and lobby enforces it per scenario", () => {
  const runner = readFileSync("scripts/e2e/run-black-box-suite.mjs", "utf8");
  const lobby = readFileSync("scripts/e2e/lobby-e2e.mjs", "utf8");

  assert.match(runner, /BLACKBOX_CASE_TIMEOUT_MS \?\? "20000"/);
  assert.match(runner, /script === "scripts\/e2e\/lobby-e2e\.mjs"/);
  assert.match(runner, /return timeoutMs \* 9/);
  assert.match(runner, /child\.kill\("SIGTERM"\)/);
  assert.match(runner, /child\.kill\("SIGKILL"\)/);

  assert.match(lobby, /LOBBY_STEP_TIMEOUT_MS = 20_000/);
  assert.match(lobby, /Promise\.race\(/);
  assert.match(lobby, /excedeu \$\{LOBBY_STEP_TIMEOUT_MS\}ms sem concluir/);
});
