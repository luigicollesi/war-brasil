import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("expositor da loja envolve as texturas do dado na geometria arredondada", () => {
  const showcase = source(
    "src/components/profile/v4/store-showcase/dice-showcase-model.tsx",
  );
  const visual = source("src/components/dice-3d/die-visual.tsx");

  assert.match(showcase, /surfaceWrappedFaces/);
  assert.match(showcase, /radius:\s*0\.285/);
  assert.match(showcase, /segments:\s*12/);

  assert.match(visual, /surfaceWrappedFaces/);
  assert.match(visual, /DICE_BOX_MATERIAL_FACE_VALUES/);
  assert.match(visual, /attach=\{`material-\$\{index\}`\}/);
});
