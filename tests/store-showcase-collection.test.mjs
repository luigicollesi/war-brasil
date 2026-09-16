import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const showcase = read("src/components/profile/v4/store-showcase/store-showcase.tsx");
const styles = read("src/components/profile/v4/store-showcase/store-showcase.module.css");
const canvas = read("src/components/pre-game/foundation/command-scene-canvas.tsx");

test("collection showcase renders canonical full-screen background with safe tactical fallback", () => {
  assert.match(showcase, /showcase\.backgroundRef/);
  assert.match(showcase, /collectionBackdrop/);
  assert.match(showcase, /onError=/);
  assert.match(showcase, /backgroundFailed/);

  assert.match(styles, /\.collectionBackdrop\s*\{/);
  assert.match(styles, /position:\s*absolute/);
  assert.match(styles, /inset:\s*0/);
  assert.match(styles, /object-fit:\s*cover/);
  assert.match(styles, /\.collectionBackdropScrim/);
  assert.match(styles, /radial-gradient/);
  assert.doesNotMatch(styles, /\.collectionBackdropScrim[^}]*background:\s*rgb\(0\s+0\s+0\s*\/\s*100%\)/s);
});

test("collection identity exposes logo and authoritative promotion semantics", () => {
  assert.match(showcase, /showcase\.logoRef/);
  assert.match(showcase, /collectionLogo/);
  assert.match(showcase, /promotionDiscountBps/);
  assert.match(showcase, /promotionBadge/);

  assert.match(styles, /\.collectionLogo/);
  assert.match(styles, /\.promotionBadge/);
});

test("collection lighting remains scene state in the shared Foundation canvas", () => {
  assert.match(canvas, /showcaseScene\.mode === "collection"/);
  assert.match(canvas, /SHOWCASE_COLLECTION_LIGHT/);
  assert.match(canvas, /SHOWCASE_STANDARD_LIGHT/);
  assert.equal((canvas.match(/<Canvas\b/g) ?? []).length, 1);
});
