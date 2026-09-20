import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const canvas = read("src/components/pre-game/foundation/command-scene-canvas.tsx");
const showcase = read("src/components/profile/v4/store-showcase/store-showcase.tsx");
const diceModel = read("src/components/profile/v4/store-showcase/dice-showcase-model.tsx");
const diceTextureHook = read("src/components/dice-3d/use-dice-face-textures.ts");
const diceAssets = read("src/lib/client/dice/dice-assets-manager.ts");
const territoryModel = read("src/components/profile/v4/store-showcase/territory-showcase-model.tsx");

test("showcase owns one Canvas and bounds high-detail models to current plus transition target", () => {
  assert.equal((canvas.match(/<Canvas\b/g) ?? []).length, 1);
  assert.equal((showcase.match(/<DiceShowcaseModel\b/g) ?? []).length, 1);
  assert.equal((showcase.match(/<TerritoryShowcaseModel\b/g) ?? []).length, 1);
  assert.match(showcase, /const activeSceneItems = useMemo/);
  assert.match(showcase, /transitionPhase !== "slide"/);
  assert.match(showcase, /transitionTargetItem\.id === selectedItem\.id/);
  assert.match(showcase, /activeSceneItems\.map\(\(\{ item, itemIndex \}\) =>/);
  assert.doesNotMatch(
    showcase,
    /showcase\.items\.map\(\(item, itemIndex\) =>\s*\(\s*<ShowcaseObjectController/s,
  );
});

test("dice showcase reuses canonical geometry and texture caches", () => {
  assert.match(diceModel, /getSharedRoundedDieGeometry/);
  assert.match(diceModel, /useDiceFaceTextures/);
  assert.match(diceTextureHook, /getDiceFaceTextures/);
  assert.match(diceAssets, /const geometryCache = new Map/);
  assert.match(diceAssets, /const textureCache = new Map/);
  assert.match(diceAssets, /geometryCache\.get/);
  assert.match(diceAssets, /textureCache\.get/);
  assert.doesNotMatch(diceModel, /new Map/);
});

test("territory mannequin uses cached SVG loading and disposes per-selection GPU resources", () => {
  assert.match(territoryModel, /useLoader\(SVGLoader/);
  assert.match(territoryModel, /geometry\.dispose\(\)/);
  assert.match(territoryModel, /frontMaterial\.dispose\(\)/);
  assert.match(territoryModel, /sideMaterial\.dispose\(\)/);
  assert.match(territoryModel, /rimMaterial\.dispose\(\)/);
  assert.match(territoryModel, /pendingTexture\.dispose\(\)/);
});
