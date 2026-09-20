import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const SHOWCASE_PATH = "src/components/profile/v4/store-showcase/store-showcase.tsx";
const TERRITORY_FALLBACK_PATH = "src/components/profile/v4/store-showcase/territory-showcase-fallback.tsx";
const STYLES_PATH = "src/components/profile/v4/store-showcase/store-showcase.module.css";

const read = (path) => readFileSync(path, "utf8");

test("semantic HTML mirrors selected item position slot ownership price and promotion", () => {
  const showcase = read(SHOWCASE_PATH);

  assert.match(showcase, /SEMANTIC_MIRROR_STYLE/);
  assert.match(showcase, /clipPath:\s*"inset\(50%\)"/);
  assert.match(showcase, /selectedIndex\s*\+\s*1/);
  assert.match(showcase, /itemCount/);
  assert.match(showcase, /itemRoleLabel\(selectedItem\)/);
  assert.match(showcase, /ownershipLabel\(selectedItem\)/);
  assert.match(showcase, /selectedOffer\.basePrice/);
  assert.match(showcase, /selectedOffer\.price/);
  assert.match(showcase, /showcase\.promotionDiscountBps/);
  assert.match(showcase, /aria-current=\{index === selectedIndex \? "true" : undefined\}/);
});

test("item strip remains keyboard native and keeps current item horizontally reachable", () => {
  const showcase = read(SHOWCASE_PATH);

  assert.match(showcase, /selectedStripItemRef/);
  assert.match(showcase, /scrollIntoView/);
  assert.match(showcase, /inline:\s*"center"/);
  assert.match(showcase, /<button/);
  assert.match(showcase, /aria-label="Exibir item anterior"/);
  assert.match(showcase, /aria-label="Exibir próximo item"/);
});

test("no-WebGL scene state swaps the 3d stage for canonical 2d item fallbacks without hiding commerce", () => {
  const showcase = read(SHOWCASE_PATH);

  assert.match(showcase, /useCommandSceneState/);
  assert.match(showcase, /sceneState === "fallback"/);
  assert.match(showcase, /data-showcase-fallback/);
  assert.match(showcase, /ProfileCosmeticImage/);
  assert.match(showcase, /TerritoryShowcaseFallback/);
  assert.match(showcase, /itemCommerce/);
  assert.match(showcase, /bundleAction/);
});

test("territory 2d fallback references the configured canonical map path instead of duplicating its polygon", () => {
  assert.equal(existsSync(TERRITORY_FALLBACK_PATH), true, "territory fallback must exist");
  const fallback = read(TERRITORY_FALLBACK_PATH);

  assert.match(fallback, /SHOWCASE_TERRITORY_SVG/);
  assert.match(fallback, /SHOWCASE_TERRITORY_ELEMENT_ID/);
  assert.match(fallback, /<use/);
  assert.match(fallback, /getBBox\(\)/);
  assert.match(fallback, /resolveTerritoryShowcaseSkin/);
  assert.doesNotMatch(fallback, /<path\b[^>]*\bd=/);
  assert.doesNotMatch(fallback, /new\s+Shape/);
});

test("showcase layout remains viewport fitted while semantic mirror stays non-visual", () => {
  const styles = read(STYLES_PATH);
  const showcase = read(SHOWCASE_PATH);

  assert.match(styles, /height:\s*100dvh/);
  assert.match(styles, /overflow:\s*hidden/);
  assert.match(styles, /\.itemStrip[^}]*overflow-x:\s*auto/s);
  assert.match(showcase, /width:\s*1/);
  assert.match(showcase, /height:\s*1/);
  assert.match(showcase, /overflow:\s*"hidden"/);
});
