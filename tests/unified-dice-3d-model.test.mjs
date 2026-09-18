import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("loja e jogo usam o mesmo DiceModel3D canônico", () => {
  const model = source("src/components/dice-3d/dice-model-3d.tsx");
  const showcase = source(
    "src/components/profile/v4/store-showcase/dice-showcase-model.tsx",
  );
  const replay = source("src/components/dice-3d/dice-trajectory-replay.tsx");
  const physics = source("src/components/dice-3d/physics-die.tsx");

  assert.match(model, /export function DiceModel3D/);

  assert.match(
    showcase,
    /import \{ DiceModel3D \} from "@\/src\/components\/dice-3d\/dice-model-3d"/,
  );
  assert.match(showcase, /<DiceModel3D/);
  assert.doesNotMatch(showcase, /surfaceWrappedFaces/);

  assert.match(replay, /import \{ DiceModel3D \} from "\.\/dice-model-3d"/);
  assert.match(replay, /<DiceModel3D/);

  assert.match(physics, /import \{ DiceModel3D \} from "\.\/dice-model-3d"/);
  assert.match(physics, /<DiceModel3D/);
});

test("modelo canônico preserva faces embrulhadas e aplica degradê nas quinas", () => {
  const model = source("src/components/dice-3d/dice-model-3d.tsx");

  assert.match(model, /DICE_BOX_MATERIAL_FACE_VALUES/);
  assert.match(model, /map=\{textures\[value\]\}/);
  assert.match(model, /resolveDiceBodyColors\(bodyColor, bodyHighlightColor\)/);

  assert.match(model, /diceBodyColor/);
  assert.match(model, /diceBodyHighlightColor/);
  assert.match(model, /diceBevelFactor/);
  assert.match(model, /diceCornerFactor/);
  assert.match(
    model,
    /mix\(diceBodyColor, diceBodyHighlightColor, diceCornerFactor\)/,
  );
  assert.match(
    model,
    /mix\(diffuseColor\.rgb, diceBevelColor, diceBevelFactor\)/,
  );

  assert.doesNotMatch(model, /surfaceWrappedFaces/);
});

test("DieVisual legado delega ao modelo canônico sem manter renderer paralelo", () => {
  const legacy = source("src/components/dice-3d/die-visual.tsx");

  assert.match(legacy, /DiceModel3D/);
  assert.doesNotMatch(legacy, /meshPhysicalMaterial/);
  assert.doesNotMatch(legacy, /onBeforeCompile/);
});

test("jogo compõe a textura 3D com a mesma bodyColor usada pela loja", () => {
  const showcase = source(
    "src/components/profile/v4/store-showcase/dice-showcase-model.tsx",
  );
  const fullscreen = source(
    "src/components/dice-3d/fullscreen-dice-cinematic.tsx",
  );

  assert.match(
    showcase,
    /useDiceFaceTextures\(\{[\s\S]*skin,[\s\S]*assetRef,[\s\S]*bodyColor,/,
  );
  assert.match(
    fullscreen,
    /useDiceFaceTextures\(\{[\s\S]*skin,[\s\S]*pipColor,[\s\S]*assetRef,[\s\S]*bodyColor,[\s\S]*\}\)/,
  );
});
