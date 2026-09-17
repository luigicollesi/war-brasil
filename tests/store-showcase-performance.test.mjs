import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const canvas = read("src/components/pre-game/foundation/command-scene-canvas.tsx");
const showcase = read("src/components/profile/v4/store-showcase/store-showcase.tsx");
const diceModel = read("src/components/profile/v4/store-showcase/dice-showcase-model.tsx");
const diceAssets = read("src/lib/client/dice/dice-assets-manager.ts");
const territoryModel = read("src/components/profile/v4/store-showcase/territory-showcase-model.tsx");

test("showcase owns one Canvas and one selected high-detail model branch", () => {
  assert.equal((canvas.match(/<Canvas\b/g) ?? []).length, 1);
  assert.equal((showcase.match(/<DiceShowcaseModel\b/g) ?? []).length, 1);
  assert.equal((showcase.match(/<TerritoryShowcaseModel\b/g) ?? []).length, 1);
  assert.match(showcase, /selectedItem\?\.type === "dice"/);
  assert.match(showcase, /selectedItem\?\.type === "territory"/);
  assert.doesNotMatch(showcase, /showcase\.items\.map\([^)]*DiceShowcaseModel/s);
  assert.doesNotMatch(showcase, /showcase\.items\.map\([^)]*TerritoryShowcaseModel/s);
});

test("dice showcase reuses canonical geometry and texture caches", () => {
  assert.match(diceModel, /getSharedRoundedDieGeometry/);
  assert.match(diceModel, /getDiceFaceTextures/);
  assert.match(diceAssets, /const geometryCache = new Map/);
  assert.match(diceAssets, /const textureCache = new Map/);
  assert.match(diceAssets, /geometryCache\.get/);
  assert.match(diceAssets, /textureCache\.get/);
});

test("territory mannequin uses cached SVG loading and disposes per-selection GPU resources", () => {
  assert.match(territoryModel, /useLoader\(SVGLoader/);
  assert.match(territoryModel, /geometry\.dispose\(\)/);
  assert.match(territoryModel, /frontMaterial\.dispose\(\)/);
  assert.match(territoryModel, /sideMaterial\.dispose\(\)/);
  assert.match(territoryModel, /rimMaterial\.dispose\(\)/);
  assert.match(territoryModel, /pendingTexture\.dispose\(\)/);
});
