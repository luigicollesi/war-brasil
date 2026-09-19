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
  assert.match(model, /pipColor:\s*DICE_VISUAL_PIP_COLOR/);
  assert.match(model, /resolution:\s*DICE_VISUAL_TEXTURE_RESOLUTION/);

  assert.doesNotMatch(model, /<boxGeometry\b/);
  assert.doesNotMatch(model, /createRoundedDieGeometry/);
  assert.doesNotMatch(model, /rapier/i);
});

test("showcase mounts every dice item into its own canonical 3d die", () => {
  assert.match(showcase, /showcase\.items\.map\(\(item, itemIndex\) => \(/);
  assert.match(showcase, /item\.type === "dice"/);
  assert.match(showcase, /<DiceShowcaseModel/);
  assert.match(showcase, /assetRef=\{item\.assetRef\}/);
  assert.match(showcase, /slot=\{item\.slot\}/);
  assert.doesNotMatch(model, /OrbitControls/);
});


test("showcase dice uses canonical unit geometry and presentation presets for framing", () => {
  const presentation = read("src/lib/client/store-showcase/showcase-presentation.ts");
  const controller = read(
    "src/components/profile/v4/store-showcase/showcase-object-controller.tsx",
  );
  const canvas = read("src/components/pre-game/foundation/command-scene-canvas.tsx");
  const runtime = read(
    "src/components/pre-game/foundation/pre-game-command-runtime.tsx",
  );

  assert.match(model, /const SHOWCASE_DIE_SIZE = 1;/);
  assert.doesNotMatch(model, /scale=\{1\.08\}/);

  assert.match(presentation, /type ShowcaseObjectType = "dice" \| "territory"/);
  assert.match(presentation, /dice:\s*\{/);
  assert.match(presentation, /territory:\s*\{/);
  assert.match(presentation, /objectScale:/);
  assert.match(presentation, /cameraFov:/);
  assert.match(presentation, /cameraDistance:/);

  assert.match(runtime, /objectType:\s*ShowcaseObjectType/);
  assert.match(
    controller,
    /resolveShowcasePresentation\(\s*objectType,\s*compact,\s*viewportAspect,\s*\)/,
  );
  assert.doesNotMatch(controller, /DESKTOP_SHOWCASE_SCALE/);
  assert.match(
    canvas,
    /resolveShowcasePresentation\(\s*objectType,\s*compact,\s*cameraAspect,\s*\)/,
  );
  assert.match(canvas, /ShowcaseCameraDirector objectType=\{showcaseScene\.objectType\}/);
});

test("dice framing preset is farther and narrower than the legacy showcase camera", () => {
  const presentation = read("src/lib/client/store-showcase/showcase-presentation.ts");

  assert.match(
    presentation,
    /dice:\s*\{[\s\S]*desktop:\s*\{[\s\S]*objectScale:\s*1\.55,[\s\S]*cameraFov:\s*30,[\s\S]*cameraDistance:\s*6\.4/,
  );
  assert.match(
    presentation,
    /dice:\s*\{[\s\S]*compact:\s*\{[\s\S]*objectScale:\s*1\.65,[\s\S]*cameraFov:\s*34,[\s\S]*cameraDistance:\s*5\.8/,
  );
});


test("portrait showcase uses a dedicated narrow-screen presentation instead of tablet compact framing", () => {
  const presentation = read("src/lib/client/store-showcase/showcase-presentation.ts");
  const controller = read(
    "src/components/profile/v4/store-showcase/showcase-object-controller.tsx",
  );
  const canvas = read("src/components/pre-game/foundation/command-scene-canvas.tsx");

  assert.match(presentation, /SHOWCASE_PORTRAIT_ASPECT_MAX = 0\.78/);
  assert.match(presentation, /portrait:\s*ShowcasePresentation/);
  assert.match(
    presentation,
    /function resolveShowcaseViewport\([\s\S]*aspectRatio <= SHOWCASE_PORTRAIT_ASPECT_MAX[\s\S]*return "portrait"/,
  );
  assert.match(
    presentation,
    /dice:\s*\{[\s\S]*portrait:\s*\{[\s\S]*objectScale:\s*0\.86,[\s\S]*cameraFov:\s*36,[\s\S]*cameraDistance:\s*6\.8/,
  );
  assert.match(
    presentation,
    /territory:\s*\{[\s\S]*portrait:\s*\{[\s\S]*objectScale:\s*0\.55,[\s\S]*cameraFov:\s*38,[\s\S]*cameraDistance:\s*6\.8/,
  );

  assert.match(
    controller,
    /resolveShowcasePresentation\(\s*objectType,\s*compact,\s*viewportAspect,\s*\)/,
  );
  assert.match(
    canvas,
    /resolveShowcasePresentation\(\s*objectType,\s*compact,\s*cameraAspect,\s*\)/,
  );
});
