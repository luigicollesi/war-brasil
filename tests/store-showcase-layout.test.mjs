import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const componentPath = "src/components/profile/v4/store-showcase/store-showcase.tsx";
const stylesPath = "src/components/profile/v4/store-showcase/store-showcase.module.css";
const routePath = "src/app/profile/store/showcase/[kind]/[id]/page.tsx";

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
