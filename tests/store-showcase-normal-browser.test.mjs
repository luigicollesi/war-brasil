import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const E2E_PATH = "scripts/e2e/store-showcase-e2e.mjs";
const read = (path) => readFileSync(path, "utf8");

test("SHOWCASE-01/05 browser eval covers a normal Simple Silver offer and browser back", () => {
  const e2e = read(E2E_PATH);

  assert.match(e2e, /normalOffer\s*=\s*offerById\(storefront,\s*["']offer\.simple-silver["']\)/);
  assert.match(e2e, /normalShowcaseUrl/);
  assert.match(e2e, /data-showcase-mode/);
  assert.match(e2e, /normalSelectedBeforeNavigation/);
  assert.match(e2e, /normalSelectedAfterNavigation/);
  assert.match(e2e, /normalHistoryReturnUrl/);
  assert.match(e2e, /\.goBack\(\)/);
  assert.match(e2e, /COMPRAR TUDO/);
});
