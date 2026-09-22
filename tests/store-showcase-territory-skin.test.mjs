import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const ADAPTER_PATH = "src/lib/client/store-showcase/territory-showcase-skin.ts";
const MODEL_PATH = "src/components/profile/v4/store-showcase/territory-showcase-model.tsx";
const GEOMETRY_PATH = "src/lib/client/store-showcase/territory-showcase-geometry.ts";
const SHOWCASE_PATH = "src/components/profile/v4/store-showcase/store-showcase.tsx";

const read = (path) => readFileSync(path, "utf8");

test("territory showcase skin reuses the authoritative game skin and material contracts", () => {
  assert.equal(existsSync(ADAPTER_PATH), true, "territory showcase skin adapter must exist");
  const adapter = read(ADAPTER_PATH);

  assert.match(adapter, /territorySkinSnapshot/);
  assert.match(adapter, /territorySkinRuntimeEffectKey/);
  assert.match(adapter, /territoryMaterial/);
  assert.match(adapter, /SHOWCASE_TERRITORY_PREVIEW_COLOR\s*=\s*["']forest["']/);
  assert.match(adapter, /SHOWCASE_TERRITORY_SKIN_OPACITY\s*=\s*0\.52/);
  assert.doesNotMatch(adapter, /cosmetics\/territory-skins\/.*\.webp/);
});

test("territory mannequin keeps canonical geometry while changing front side and rim treatment", () => {
  const model = read(MODEL_PATH);

  assert.match(model, /resolveTerritoryShowcaseSkin/);
  assert.match(model, /frontColor/);
  assert.match(model, /sideColor/);
  assert.match(model, /rimColor/);
  assert.match(model, /EdgesGeometry/);
  assert.match(model, /LineBasicMaterial/);
  assert.match(model, /skinAssetRef/);
  assert.match(model, /TextureLoader/);
  assert.match(model, /loader\.load/);
  assert.match(model, /texture:\s*null/);
  assert.doesNotMatch(model, /useLoader\(TextureLoader/);
});

test("territory geometry provides centered square UVs so skins are not stretched with territory aspect", () => {
  const geometry = read(GEOMETRY_PATH);

  assert.match(geometry, /getAttribute\(["']position["']\)/);
  assert.match(geometry, /getAttribute\(["']uv["']\)/);
  assert.match(geometry, /dominantExtent/);
  assert.match(geometry, /setXY/);
});

test("mixed showcases pass the selected territory cosmetic into the same shared scene", () => {
  const showcase = read(SHOWCASE_PATH);

  assert.match(showcase, /<DiceShowcaseModel/);
  assert.match(showcase, /<TerritoryShowcaseModel/);
  assert.match(showcase, /cosmeticId=\{selectedItem\.id\}/);
  assert.match(showcase, /assetRef=\{selectedItem\.assetRef\}/);
  assert.match(
    read("src/lib/client/store-showcase/territory-showcase-skin.ts"),
    /objectKey\.startsWith\("cosmetics\/territory-skins\/"\)/,
  );
  assert.match(showcase, /effectKey=\{selectedItem\.effectKey\}/);
});
