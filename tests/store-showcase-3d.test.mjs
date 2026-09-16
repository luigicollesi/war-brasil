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

test("showcase scene has fixed-camera exhibition controls without Rapier", () => {
  assert.doesNotMatch(controller, /rapier/i);
  assert.doesNotMatch(pedestal, /rapier/i);
  assert.doesNotMatch(motion, /rapier/i);

  assert.match(controller, /useFrame/);
  assert.match(controller, /onPointerDown/);
  assert.match(controller, /onPointerMove/);
  assert.match(controller, /onPointerUp/);
  assert.match(controller, /rotation\.y/);
  assert.match(controller, /rotation\.x/);

  assert.match(motion, /SHOWCASE_IDLE_REVOLUTION_SECONDS/);
  assert.match(motion, /prefersReducedMotion/);
  assert.match(motion, /idleAngularVelocity/);
});

test("pedestal identity is stable and lighting switches between standard and collection modes", () => {
  assert.match(pedestal, /name="StoreShowcasePedestal"/);
  assert.match(pedestal, /mode === "collection"/);
  assert.match(canvas, /StoreShowcasePedestal/);
  assert.match(canvas, /showcaseScene\.mode === "collection"/);
  assert.match(canvas, /SHOWCASE_COLLECTION_LIGHT/);
  assert.match(canvas, /SHOWCASE_STANDARD_LIGHT/);
});
