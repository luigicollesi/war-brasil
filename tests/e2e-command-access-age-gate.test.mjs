import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const helper = readFileSync("scripts/e2e/command-access-helper.mjs", "utf8");
const onboardingScripts = [
  "scripts/e2e/auth-credentials-verification-e2e.mjs",
  "scripts/e2e/auth-seat-boundary-e2e.mjs",
  "scripts/e2e/lobby-e2e.mjs",
  "scripts/e2e/economy-e2e.mjs",
  "scripts/e2e/game-modes-e2e.mjs",
  "scripts/e2e/economy-game-e2e.mjs",
  "scripts/e2e/game-modes-victory-e2e.mjs",
  "scripts/e2e/economy-purchase-e2e.mjs",
  "scripts/e2e/store-showcase-e2e.mjs",
];

test("E2E commander onboarding completes the public age gate before identity", () => {
  assert.match(helper, /"\/api\/auth\/command-access\/age"/);
  assert.match(helper, /method: "POST"/);
  assert.match(helper, /birthDate/);
  assert.match(helper, /ageGateComplete/);
  assert.match(helper, /completeCommanderAgeGate\(page, birthDate\)/);
  assert.match(helper, /"\/api\/auth\/command-access"/);
  assert.match(helper, /method: "PUT"/);
  assert.match(helper, /profileComplete/);

  for (const path of onboardingScripts) {
    const source = readFileSync(path, "utf8");
    assert.match(
      source,
      /command-access-helper\.mjs/,
      `${path} must reuse the canonical E2E command-access helper`,
    );
    assert.doesNotMatch(
      source,
      /apiJson\(page, "\/api\/auth\/command-access", \{\s*method: "PUT"/s,
      `${path} must not bypass the E2E age-gate helper`,
    );
  }
});
