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

  for (const consumer of [showcase, fullscreen]) {
    assert.match(consumer, /useDiceFaceTextures/);
    assert.match(consumer, /bodyColor/);
    assert.match(consumer, /DICE_VISUAL_PIP_COLOR/);
    assert.match(consumer, /DICE_VISUAL_TEXTURE_RESOLUTION/);
  }
});

test("loja e jogo derivam a mesma geometria visual canônica", () => {
  const visualConfig = source("src/lib/client/dice/visual-config.ts");
  const physicsConfig = source(
    "src/lib/client/dice/physics/dice-physics-config.ts",
  );
  const showcase = source(
    "src/components/profile/v4/store-showcase/dice-showcase-model.tsx",
  );

  assert.match(visualConfig, /DICE_VISUAL_RADIUS_RATIO = 0\.15/);
  assert.match(visualConfig, /DICE_VISUAL_SEGMENTS = 12/);
  assert.match(visualConfig, /export function diceVisualGeometry/);

  assert.match(physicsConfig, /diceVisualGeometry\(1\)/);
  assert.match(physicsConfig, /dieRadius: DICE_GAME_VISUAL_GEOMETRY\.radius/);
  assert.match(physicsConfig, /dieSegments: DICE_GAME_VISUAL_GEOMETRY\.segments/);

  assert.match(showcase, /diceVisualGeometry\(SHOWCASE_DIE_SIZE\)/);
  assert.doesNotMatch(
    showcase,
    /getSharedRoundedDieGeometry\(\{ size: 1\.9, radius: 0\.285, segments: 12 \}\)/,
  );
});

test("loja e cinematic 3D usam a mesma composição visual de textura", () => {
  const visualConfig = source("src/lib/client/dice/visual-config.ts");
  const showcase = source(
    "src/components/profile/v4/store-showcase/dice-showcase-model.tsx",
  );
  const fullscreen = source(
    "src/components/dice-3d/fullscreen-dice-cinematic.tsx",
  );

  assert.match(visualConfig, /DICE_VISUAL_PIP_COLOR = "#0b0b0b"/);
  assert.match(visualConfig, /DICE_VISUAL_TEXTURE_RESOLUTION = 512/);

  for (const consumer of [showcase, fullscreen]) {
    assert.match(consumer, /DICE_VISUAL_PIP_COLOR/);
    assert.match(consumer, /DICE_VISUAL_TEXTURE_RESOLUTION/);
  }

  assert.doesNotMatch(fullscreen, /pipColor\?: string/);
});
