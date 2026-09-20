import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const motion = read("src/lib/client/store-showcase/showcase-motion.ts");
const controller = read("src/components/profile/v4/store-showcase/showcase-object-controller.tsx");
const showcase = read("src/components/profile/v4/store-showcase/store-showcase.tsx");
const canvas = read("src/components/pre-game/foundation/command-scene-canvas.tsx");

test("persistent carousel uses one simultaneous 460ms slide instead of exit-enter halves", () => {
  assert.match(motion, /SHOWCASE_ITEM_TRANSITION_MS\s*=\s*460/);
  assert.doesNotMatch(motion, /SHOWCASE_ITEM_TRANSITION_PHASE_MS/);
  assert.match(motion, /type ShowcaseTransitionPhase = "idle" \| "slide"/);
  assert.match(motion, /showcaseTransitionProgress/);
  assert.match(motion, /linear \* linear \* \(3 - 2 \* linear\)/);

  assert.match(showcase, /setTransitionPhase\("slide"\)/);
  assert.doesNotMatch(showcase, /setTransitionPhase\("exit"\)/);
  assert.doesNotMatch(showcase, /setTransitionPhase\("enter"\)/);
  assert.match(showcase, /SHOWCASE_ITEM_TRANSITION_MS/);
});

test("current and target models slide simultaneously in opposite directions", () => {
  assert.match(controller, /transitionPhase === "slide"/);
  assert.match(controller, /isSelected/);
  assert.match(controller, /isTarget/);
  assert.match(
    controller,
    /isSelected[\s\S]*-transitionDirection \* SHOWCASE_STANDBY_X \* progress/,
  );
  assert.match(
    controller,
    /isTarget[\s\S]*transitionDirection \* SHOWCASE_STANDBY_X \* \(1 - progress\)/,
  );
  assert.match(controller, /Math\.sin\(Math\.PI \* progress\)/);
  assert.match(controller, /group\.scale\.setScalar/);

  assert.match(showcase, /<ShowcaseObjectController/);
  assert.match(showcase, /transitionTargetItemId=\{transitionTargetItemId\}/);
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
