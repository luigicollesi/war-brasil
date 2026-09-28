import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const showcase = read("src/components/profile/v4/store-showcase/store-showcase.tsx");
const styles = read("src/components/profile/v4/store-showcase/store-showcase.module.css");
const atmosphere = read(
  "src/components/profile/v4/store-showcase/collection-showcase-atmosphere.tsx",
);
const canvas = read("src/components/pre-game/foundation/command-scene-canvas.tsx");

test("collection showcase renders its canonical background in the store DOM", () => {
  assert.match(showcase, /showcase\.mode === "collection" && showcase\.backgroundRef/);
  assert.match(showcase, /className=\{styles\.collectionBackdrop\}/);
  assert.match(showcase, /src=\{showcase\.backgroundRef\}/);
  assert.match(showcase, /className=\{styles\.collectionBackdropScrim\}/);
  assert.match(showcase, /<CollectionShowcaseAtmosphere \/>/);

  assert.match(styles, /\.collectionBackdrop\s*\{/);
  assert.match(styles, /\.collectionBackdrop img\s*\{/);
  assert.match(styles, /object-fit: cover/);
  assert.match(styles, /\.collectionBackdropScrim\s*\{/);

  assert.doesNotMatch(atmosphere, /backgroundImage|collectionBackdrop|data-command-scene/);
});

test("collection identity exposes logo and authoritative promotion semantics", () => {
  assert.match(showcase, /showcase\.logoRef/);
  assert.match(showcase, /collectionLogo/);
  assert.match(showcase, /promotionDiscountBps/);
  assert.match(showcase, /promotionBadge/);

  assert.match(styles, /\.collectionLogo/);
  assert.match(styles, /\.promotionBadge/);
});

test("collection atmosphere uses the transparent Foundation canvas and its own rear light", () => {
  assert.match(canvas, /alpha: true/);
  assert.match(canvas, /SceneClearDirector/);
  assert.match(canvas, /SHOWCASE_STANDARD_LIGHT/);
  assert.doesNotMatch(canvas, /SHOWCASE_COLLECTION_LIGHT/);
  assert.match(atmosphere, /CollectionShowcaseRearLighting/);
  assert.match(atmosphere, /color="#dfb45a"/);
  assert.equal((canvas.match(/<Canvas\b/g) ?? []).length, 1);
});
