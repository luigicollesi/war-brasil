import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const model = read("src/components/profile/v4/store-showcase/dice-showcase-model.tsx");
const showcase = read("src/components/profile/v4/store-showcase/store-showcase.tsx");

test("showcase die reuses canonical geometry and face texture pipeline", () => {
  assert.match(model, /DiceModel3D/);
  assert.match(model, /getSharedRoundedDieGeometry/);
  assert.match(model, /useDiceFaceTextures/);
  assert.match(model, /assetRef/);
  assert.match(model, /pipColor:\s*["']#0b0b0b["']/);

  assert.doesNotMatch(model, /<boxGeometry\b/);
  assert.doesNotMatch(model, /createRoundedDieGeometry/);
  assert.doesNotMatch(model, /rapier/i);
});

test("showcase routes dice items into the canonical 3d die without changing the camera", () => {
  assert.match(showcase, /selectedItem\?\.type === "dice"/);
  assert.match(showcase, /<DiceShowcaseModel/);
  assert.match(showcase, /assetRef=\{selectedItem\.assetRef\}/);
  assert.match(showcase, /slot=\{selectedItem\.slot\}/);
  assert.doesNotMatch(model, /OrbitControls/);
});
