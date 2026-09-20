import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

const repository = source("src/lib/server/economy/economy-repository.ts");
const storefrontRepository = source(
  "src/lib/server/economy/economy-storefront-repository.ts",
);
const service = source("src/lib/server/economy/economy-service.ts");

test("CosmeticRow transporta as duas cores do corpo do dado", () => {
  assert.match(repository, /body_color: string \| null/);
  assert.match(repository, /body_highlight_color: string \| null/);
});

test("queries de cosméticos projetam body_color e body_highlight_color", () => {
  const combined = repository + storefrontRepository;
  const assetRefSelections = combined.match(/item\.asset_ref,/g) ?? [];
  const bodyColorSelections = combined.match(/item\.body_color,/g) ?? [];
  const highlightSelections =
    combined.match(/item\.body_highlight_color,/g) ?? [];

  assert.ok(assetRefSelections.length >= 7);
  assert.equal(bodyColorSelections.length, assetRefSelections.length);
  assert.equal(highlightSelections.length, assetRefSelections.length);
});

test("serviço projeta as cores persistidas no CosmeticCatalogItem", () => {
  assert.match(service, /bodyColor: row\.body_color/);
  assert.match(service, /bodyHighlightColor: row\.body_highlight_color/);
});
