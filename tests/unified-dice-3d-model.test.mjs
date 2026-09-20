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
  assert.match(model, /diceEdgeMask/);
  assert.match(model, /diceCornerFactor/);
  assert.match(
    model,
    /mix\(diceBodyColor, diceBodyHighlightColor, diceCornerFactor \* diceEdgeMask\)/,
  );
  assert.match(
    model,
    /mix\(diceBodySurfaceColor, diceArtworkColor, diceArtworkAlpha\)/,
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
    assert.match(consumer, /DICE_VISUAL_TEXTURE_RESOLUTION/);
  }
  assert.match(showcase, /DICE_VISUAL_PIP_COLOR/);
  assert.match(fullscreen, /pipColor: playerColorHex\(color\)/);
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

test("loja e cinematic 3D compartilham composição, mas jogo usa pips da cor do jogador", () => {
  const visualConfig = source("src/lib/client/dice/visual-config.ts");
  const showcase = source(
    "src/components/profile/v4/store-showcase/dice-showcase-model.tsx",
  );
  const fullscreen = source(
    "src/components/dice-3d/fullscreen-dice-cinematic.tsx",
  );

  assert.match(visualConfig, /DICE_VISUAL_PIP_COLOR = "#0b0b0b"/);
  assert.match(visualConfig, /DICE_VISUAL_TEXTURE_RESOLUTION = 512/);
  assert.match(visualConfig, /DICE_VISUAL_TEXTURE_UV_SCALE = 1/);
  assert.match(visualConfig, /DICE_VISUAL_EDGE_DISSOLVE_START = 0\.84/);
  assert.match(visualConfig, /DICE_VISUAL_EDGE_DISSOLVE_END = 0\.96/);
  assert.match(visualConfig, /DICE_VISUAL_CORNER_HIGHLIGHT_START = 0\.76/);
  assert.match(visualConfig, /DICE_VISUAL_CORNER_HIGHLIGHT_END = 0\.94/);

  for (const consumer of [showcase, fullscreen]) {
    assert.match(consumer, /DICE_VISUAL_TEXTURE_RESOLUTION/);
  }

  assert.match(showcase, /DICE_VISUAL_PIP_COLOR/);
  assert.match(fullscreen, /playerColorHex\(color\)/);
  assert.doesNotMatch(fullscreen, /DICE_VISUAL_PIP_COLOR/);
  assert.doesNotMatch(fullscreen, /pipColor\?: string/);
});


test("modelo canônico centraliza zoom da arte e faixa de highlight", () => {
  const visualConfig = source("src/lib/client/dice/visual-config.ts");
  const assets = source("src/lib/client/dice/dice-assets-manager.ts");
  const model = source("src/components/dice-3d/dice-model-3d.tsx");

  assert.match(assets, /DICE_VISUAL_TEXTURE_UV_SCALE/);
  assert.match(assets, /texture\.center\.set\(0\.5, 0\.5\)/);
  assert.match(assets, /texture\.repeat\.set/);

  for (const name of [
    "DICE_VISUAL_EDGE_DISSOLVE_START",
    "DICE_VISUAL_EDGE_DISSOLVE_END",
    "DICE_VISUAL_CORNER_HIGHLIGHT_START",
    "DICE_VISUAL_CORNER_HIGHLIGHT_END",
  ]) {
    assert.match(visualConfig, new RegExp(name));
    assert.match(model, new RegExp(name));
  }
});


test("borda dissolve no corpo sob a WebP sem alterar a arte", () => {
  const visualConfig = source("src/lib/client/dice/visual-config.ts");
  const model = source("src/components/dice-3d/dice-model-3d.tsx");

  assert.match(visualConfig, /DICE_VISUAL_EDGE_DISSOLVE_START = 0\.84/);
  assert.match(visualConfig, /DICE_VISUAL_EDGE_DISSOLVE_END = 0\.96/);

  assert.match(model, /float diceArtworkAlpha = diffuseColor\.a/);
  assert.match(model, /vec3 diceArtworkColor = diffuseColor\.rgb/);
  assert.match(model, /float diceEdgeMask = smoothstep/);
  assert.match(
    model,
    /diffuseColor\.rgb = mix\(diceBodySurfaceColor, diceArtworkColor, diceArtworkAlpha\)/,
  );
});


test("WebP preserva alpha e revela corpo com highlight sem tingir a arte opaca", () => {
  const texture = source(
    "src/lib/client/dice/textures/create-face-texture.ts",
  );
  const model = source("src/components/dice-3d/dice-model-3d.tsx");

  assert.doesNotMatch(texture, /function drawBodyColor/);
  assert.doesNotMatch(texture, /fillStyle\s*=\s*bodyColor/);

  assert.match(model, /float diceArtworkAlpha = diffuseColor\.a/);
  assert.match(model, /vec3 diceArtworkColor = diffuseColor\.rgb/);
  assert.match(
    model,
    /vec3 diceBodySurfaceColor = mix\(diceBodyColor, diceBodyHighlightColor, diceCornerFactor \* diceEdgeMask\)/,
  );
  assert.match(
    model,
    /diffuseColor\.rgb = mix\(diceBodySurfaceColor, diceArtworkColor, diceArtworkAlpha\)/,
  );
  assert.match(model, /diffuseColor\.a = 1\.0/);
});
