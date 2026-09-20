import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const CONFIG_PATH = "src/lib/client/store-showcase/territory-showcase-config.ts";
const GEOMETRY_PATH = "src/lib/client/store-showcase/territory-showcase-geometry.ts";
const MODEL_PATH = "src/components/profile/v4/store-showcase/territory-showcase-model.tsx";
const SHOWCASE_PATH = "src/components/profile/v4/store-showcase/store-showcase.tsx";
const CANONICAL_MAP_PATH = "public/war-brasil-42.production.svg";

const read = (path) => readFileSync(path, "utf8");

test("territory mannequin selects a real canonical territory from the production SVG", () => {
  assert.equal(existsSync(CONFIG_PATH), true, "territory showcase config must exist");
  const config = read(CONFIG_PATH);
  const map = read(CANONICAL_MAP_PATH);
  const idMatch = config.match(/SHOWCASE_TERRITORY_ID\s*=\s*(\d+)/);

  assert.ok(idMatch, "showcase territory id must be explicit and stable");
  const territoryId = Number(idMatch[1]);
  assert.ok(territoryId >= 1 && territoryId <= 42);
  assert.match(config, /SHOWCASE_TERRITORY_SVG\s*=\s*["']\/war-brasil-42\.production\.svg["']/);
  assert.match(config, /SHOWCASE_TERRITORY_ELEMENT_ID/);
  assert.match(map, new RegExp(`id=["']territory-${territoryId}["']`));
  assert.match(map, new RegExp(`data-id=["']${territoryId}["']`));
});

test("territory mannequin geometry is derived, normalized and shallow-extruded from SVG shapes", () => {
  assert.equal(existsSync(GEOMETRY_PATH), true, "territory showcase geometry helper must exist");
  const geometry = read(GEOMETRY_PATH);

  assert.match(geometry, /ExtrudeGeometry/);
  assert.match(geometry, /Box3/);
  assert.match(geometry, /getCenter/);
  assert.match(geometry, /getSize/);
  assert.match(geometry, /Math\.max/);
  assert.match(geometry, /translate/);
  assert.match(geometry, /scale/);
  assert.match(geometry, /bevelEnabled:\s*true/);
  assert.doesNotMatch(geometry, /new\s+Shape\s*\(/);
  assert.doesNotMatch(geometry, /\.moveTo\s*\(/);
  assert.doesNotMatch(geometry, /\.lineTo\s*\(/);
});

test("territory showcase model loads the canonical SVG path and keeps front/side material groups", () => {
  assert.equal(existsSync(MODEL_PATH), true, "territory showcase model must exist");
  const model = read(MODEL_PATH);

  assert.match(model, /useLoader\(SVGLoader,\s*SHOWCASE_TERRITORY_SVG\)/);
  assert.match(model, /SHOWCASE_TERRITORY_ELEMENT_ID/);
  assert.match(model, /\.toShapes\(\)/);
  assert.match(model, /createTerritoryShowcaseGeometry/);
  assert.match(model, /frontMaterial/);
  assert.match(model, /sideMaterial/);
  assert.match(model, /name="StoreShowcaseTerritory"/);
  assert.doesNotMatch(model, /<boxGeometry\b/);
});

test("territory showcase items render the canonical 3d mannequin in the shared scene", () => {
  const showcase = read(SHOWCASE_PATH);

  assert.match(showcase, /TerritoryShowcaseModel/);
  assert.match(showcase, /selectedItem\?\.type === "territory"/);
  assert.match(showcase, /<TerritoryShowcaseModel/);
  assert.doesNotMatch(showcase, /StoreShowcaseModelSlot/);
});
