import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const componentPath = "src/components/profile/v4/store-showcase/store-showcase.tsx";
const stylesPath = "src/components/profile/v4/store-showcase/store-showcase.module.css";
const routePath = "src/app/profile/store/showcase/[kind]/[id]/page.tsx";
const controllerPath = "src/components/profile/v4/store-showcase/showcase-object-controller.tsx";
const pedestalPath = "src/components/profile/v4/store-showcase/showcase-pedestal.tsx";

function read(path) {
  return readFileSync(path, "utf8");
}

test("store showcase layout is a fitted three-zone 100dvh shell", () => {
  const component = read(componentPath);
  const styles = read(stylesPath);
  const route = read(routePath);

  assert.match(component, /data-showcase-zone="header"/);
  assert.match(component, /data-showcase-zone="stage"/);
  assert.match(component, /data-showcase-zone="dock"/);
  assert.match(component, /className=\{styles\.itemStrip\}/);
  assert.match(component, /className=\{styles\.bundleAction\}/);

  assert.match(styles, /height:\s*100dvh/);
  assert.match(styles, /grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto/);
  assert.match(styles, /overflow:\s*hidden/);
  assert.match(styles, /\.stage\s*\{[^}]*min-height:\s*0/s);
  assert.match(styles, /\.itemStrip\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(styles, /@media\s*\(max-height:\s*760px\)/);
  assert.match(styles, /@media\s*\(max-width:\s*720px\)/);

  assert.match(route, /import \{ StoreShowcase \}/);
  assert.doesNotMatch(route, /function StoreShowcase\(/);
});

test("store showcase keeps secondary copy collapsible before the stage", () => {
  const component = read(componentPath);
  const styles = read(stylesPath);

  assert.match(component, /className=\{styles\.description\}/);
  assert.match(styles, /@media\s*\(max-height:\s*760px\)[\s\S]*\.description\s*\{[^}]*display:\s*none/s);
  assert.match(styles, /\.stageObject\s*\{[^}]*clamp\(/s);
});

test("showcase centers 3D content on the measured exhibition field instead of the full desktop", () => {
  const component = read(componentPath);
  const controller = read(controllerPath);
  const canvas = read("src/components/pre-game/foundation/command-scene-canvas.tsx");

  assert.match(component, /stageCenterRatio/);
  assert.match(component, /getBoundingClientRect\(\)/);
  assert.match(component, /ResizeObserver/);
  assert.match(canvas, /function ShowcaseStageAnchor/);
  assert.match(canvas, /stageCenterRatio/);
  assert.match(canvas, /viewportWidth/);
  assert.doesNotMatch(controller, /DESKTOP_SHOWCASE_X/);
});

test("standard pedestal shares the measured stage anchor and collections do not render it", () => {
  const pedestal = read(pedestalPath);
  const canvas = read("src/components/pre-game/foundation/command-scene-canvas.tsx");

  assert.match(pedestal, /if \(mode === "collection"\) return null;/);
  assert.match(pedestal, /position=\{\[0, -1\.45, 0\]\}/);
  assert.match(canvas, /<ShowcaseStageAnchor/);
  assert.match(canvas, /<StoreShowcasePedestal mode=\{showcaseScene\.mode\}/);
});

test("showcase removes the always-on css platform below every item", () => {
  const styles = read(stylesPath);

  assert.doesNotMatch(styles, /\.stageObject::before/);
});
