import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const runtime = read("src/components/pre-game/foundation/pre-game-command-runtime.tsx");
const shell = read("src/components/pre-game/foundation/command-shell.tsx");
const scene = read("src/components/pre-game/foundation/command-scene.tsx");
const canvas = read("src/components/pre-game/foundation/command-scene-canvas.tsx");
const showcase = read("src/components/profile/v4/store-showcase/store-showcase.tsx");
const controller = read("src/components/profile/v4/store-showcase/showcase-object-controller.tsx");
const pedestal = read("src/components/profile/v4/store-showcase/showcase-pedestal.tsx");
const motion = read("src/lib/client/store-showcase/showcase-motion.ts");

test("showcase reuses the Foundation WebGL runtime instead of mounting another Canvas", () => {
  assert.match(runtime, /ShowcaseSceneContext/);
  assert.match(runtime, /useShowcaseScene/);
  assert.match(shell, /showcaseScene/);
  assert.match(scene, /showcaseScene/);
  assert.match(canvas, /showcaseScene/);

  assert.doesNotMatch(showcase, /<Canvas\b/);
  assert.doesNotMatch(showcase, /from\s+["']@react-three\/fiber["']/);
  assert.equal((canvas.match(/<Canvas\b/g) ?? []).length, 1);
});

test("showcase keeps fixed-camera auto-rotation while horizontal gestures navigate the exhibition", () => {
  assert.doesNotMatch(controller, /rapier/i);
  assert.doesNotMatch(pedestal, /rapier/i);
  assert.doesNotMatch(motion, /rapier/i);

  assert.match(controller, /useFrame/);
  assert.match(controller, /rotation\.y/);
  assert.doesNotMatch(controller, /onPointerDown/);
  assert.doesNotMatch(controller, /onPointerMove/);

  assert.match(showcase, /data-showcase-swipe-surface/);
  assert.match(showcase, /onPointerDown=\{beginStageSwipe\}/);
  assert.match(showcase, /onPointerMove=\{updateStageSwipe\}/);
  assert.match(motion, /SHOWCASE_IDLE_REVOLUTION_SECONDS/);
  assert.match(motion, /resolveShowcaseSwipeDirection/);
});

test("pedestal identity is stable and collection atmosphere stays outside the shared light rig", () => {
  assert.match(pedestal, /name="StoreShowcasePedestal"/);
  assert.match(pedestal, /mode === "collection"/);
  assert.match(canvas, /StoreShowcasePedestal/);
  assert.match(canvas, /SHOWCASE_STANDARD_LIGHT/);
  assert.match(canvas, /alpha: true/);
  assert.match(canvas, /SceneClearDirector/);
  assert.doesNotMatch(canvas, /SHOWCASE_COLLECTION_LIGHT/);
});


test("showcase camera derives perspective aspect from the live canvas size", () => {
  assert.match(canvas, /const canvasSize = useThree\(\(state\) => state\.size\);/);
  assert.match(
    canvas,
    /const cameraAspect =\s*canvasSize\.height > 0\s*\? canvasSize\.width \/ canvasSize\.height\s*:\s*1;/,
  );
  assert.match(
    canvas,
    /new PerspectiveCamera\(\s*presentation\.cameraFov,\s*cameraAspect,\s*0\.1,\s*40,?\s*\)/,
  );
  assert.match(
    canvas,
    /\[cameraAspect, compact, invalidate, presentation, set\]/,
  );
  assert.doesNotMatch(
    canvas,
    /new PerspectiveCamera\(\s*presentation\.cameraFov,\s*1,\s*0\.1,\s*40/,
  );
});
