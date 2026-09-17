import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const E2E_PATH = "scripts/e2e/store-showcase-e2e.mjs";
const WORKFLOW_PATH = ".github/workflows/test.yml";

const read = (path) => readFileSync(path, "utf8");

test("store showcase browser eval covers the exact viewport matrix and degradation paths", () => {
  assert.equal(existsSync(E2E_PATH), true, "store showcase E2E script must exist");
  const e2e = read(E2E_PATH);

  for (const viewport of [
    "360, 640",
    "390, 844",
    "768, 1024",
    "1280, 720",
    "1366, 768",
    "1440, 900",
    "1920, 1080",
  ]) {
    assert.match(e2e, new RegExp(`\\[${viewport.replace(", ", ",\\s*")}\\]`));
  }

  assert.match(e2e, /scrollHeight/);
  assert.match(e2e, /clientHeight/);
  assert.match(e2e, /data-showcase-fallback/);
  assert.match(e2e, /HTMLCanvasElement\.prototype\.getContext/);
  assert.match(e2e, /COMPRAR ITEM/);
  assert.match(e2e, /COMPLETAR/);
  assert.match(e2e, /data-collection-background/);
  assert.match(e2e, /collection\.nao-existe/);
});

test("no-WebGL browser eval proves that navigation still changes the selected item", () => {
  const e2e = read(E2E_PATH);

  assert.match(e2e, /fallbackSelectedBeforeNavigation/);
  assert.match(e2e, /fallbackNextArrow/);
  assert.match(e2e, /fallbackSelectedAfterNavigation/);
  assert.match(e2e, /assert\.notEqual\(fallbackSelectedAfterNavigation, fallbackSelectedBeforeNavigation\)/);
});

test("SHOWCASE-28 browser eval proves stale price fails closed and requires explicit reconfirmation", () => {
  const e2e = read(E2E_PATH);

  assert.match(e2e, /setCollectionPromotionDiscount/);
  assert.match(e2e, /stalePriceStateBeforeAttempt/);
  assert.match(e2e, /stalePriceStateAfterAttempt/);
  assert.match(e2e, /O preço mudou para 400 CR\. Confirme o novo valor\./);
  assert.match(e2e, /stalePriceCta/);
  assert.match(e2e, /stalePriceStateAfterPurchase/);
  assert.match(e2e, /promotion_discount_bps=4000/);
});

test("main CI executes showcase browser eval and retains its evidence", () => {
  const workflow = read(WORKFLOW_PATH);

  assert.match(workflow, /node scripts\/e2e\/store-showcase-e2e\.mjs/);
  assert.match(workflow, /STORE_SHOWCASE_E2E_ARTIFACT_DIR:\s*test-results\/store-showcase-eval/);
  assert.match(workflow, /test-results\/store-showcase-eval/);
});
