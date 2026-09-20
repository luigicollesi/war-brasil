import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("expositor e jogo usam a mesma superfície 3D canônica com textura embrulhada", () => {
  const showcase = source(
    "src/components/profile/v4/store-showcase/dice-showcase-model.tsx",
  );
  const model = source("src/components/dice-3d/dice-model-3d.tsx");
  const visualConfig = source("src/lib/client/dice/visual-config.ts");

  assert.match(showcase, /DiceModel3D/);
  assert.match(showcase, /diceVisualGeometry\(SHOWCASE_DIE_SIZE\)/);
  assert.match(showcase, /getSharedRoundedDieGeometry\(SHOWCASE_DIE_GEOMETRY\)/);

  assert.match(visualConfig, /DICE_VISUAL_RADIUS_RATIO = 0\.15/);
  assert.match(visualConfig, /DICE_VISUAL_SEGMENTS = 12/);
  assert.match(model, /DICE_BOX_MATERIAL_FACE_VALUES/);
  assert.match(model, /attach=\{`material-\$\{index\}`\}/);
  assert.match(model, /map=\{textures\[value\]\}/);
});
