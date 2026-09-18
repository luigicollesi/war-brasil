import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const motion = read("src/lib/client/store-showcase/showcase-motion.ts");
const controller = read("src/components/profile/v4/store-showcase/showcase-object-controller.tsx");
const showcase = read("src/components/profile/v4/store-showcase/store-showcase.tsx");
const canvas = read("src/components/pre-game/foundation/command-scene-canvas.tsx");

test("item replacement uses one short 300ms transition split into exit and enter phases", () => {
  assert.match(motion, /SHOWCASE_ITEM_TRANSITION_MS\s*=\s*300/);
  assert.match(motion, /SHOWCASE_ITEM_TRANSITION_PHASE_MS\s*=\s*SHOWCASE_ITEM_TRANSITION_MS\s*\/\s*2/);
  assert.match(motion, /showcaseTransitionProgress/);
  assert.match(motion, /prefersReducedMotion/);

  assert.match(showcase, /transitionPhase/);
  assert.match(showcase, /"exit"/);
  assert.match(showcase, /"enter"/);
  assert.match(showcase, /SHOWCASE_ITEM_TRANSITION_PHASE_MS/);
});

test("old and new models transition on the same anchored object group", () => {
  assert.match(controller, /transitionPhase/);
  assert.match(controller, /transitionDirection/);
  assert.match(controller, /showcaseTransitionProgress/);
  assert.match(controller, /group\.position\.x/);
  assert.match(controller, /group\.scale\.setScalar/);

  assert.match(showcase, /<ShowcaseObjectController/);
  assert.match(showcase, /transitionPhase=\{transitionPhase\}/);
  assert.match(showcase, /transitionDirection=\{transitionDirection\}/);
});

test("transition never remounts or translates camera and pedestal", () => {
  assert.equal((canvas.match(/<Canvas\b/g) ?? []).length, 1);
  assert.match(canvas, /<StoreShowcasePedestal mode=\{showcaseScene\.mode\}/);
  assert.doesNotMatch(canvas, /transitionPhase/);
  assert.doesNotMatch(canvas, /transitionDirection/);
});

test("reduced motion performs immediate item replacement", () => {
  assert.match(showcase, /prefersReducedMotion/);
  assert.match(showcase, /setSelectedItemId\(targetItemId\)/);
  assert.match(showcase, /if \(prefersReducedMotion\)/);
});


test("horizontal mouse or touch swipes reuse the same previous and next selection flow as the arrows", () => {
  assert.match(motion, /SHOWCASE_SWIPE_THRESHOLD_PX/);
  assert.match(motion, /resolveShowcaseSwipeDirection/);
  assert.match(showcase, /beginStageSwipe/);
  assert.match(showcase, /updateStageSwipe/);
  assert.match(showcase, /moveSelection\(direction\)/);
  assert.match(showcase, /onPointerDown=\{beginStageSwipe\}/);
  assert.match(showcase, /onPointerMove=\{updateStageSwipe\}/);
});
