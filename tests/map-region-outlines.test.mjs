import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const generator = readFileSync("scripts/generate-region-outlines.mjs", "utf8");
const visualState = readFileSync(
  "src/lib/client/map/territory-visual-state.ts",
  "utf8",
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

const REGIONS = ["norte", "nordeste", "centro-oeste", "sudeste", "sul"];

test("region silhouettes are generated from the 42 canonical face masks", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/generate-region-outlines.mjs", "--check"],
    { encoding: "utf8" },
  );

  assert.equal(
    result.status,
    0,
    `region silhouette generator failed:\n${result.stderr || result.stdout}`,
  );
  assert.match(result.stdout, /Region silhouettes ready:/);
  for (const region of REGIONS) assert.match(result.stdout, new RegExp(`${region}=\\d+`));
});

test("visible region outlines belong to regional silhouettes, not territory paths", () => {
  assert.match(generator, /id="region-outline-defs"/);
  assert.match(generator, /id="region-shape-\$\{region\}"/);
  assert.match(generator, /id="region-outline-mask-\$\{region\}"/);
  assert.match(generator, /href="#region-shape-\$\{region\}"/);
  assert.match(generator, /mask="url\(#region-outline-mask-\$\{region\}\)"/);
  assert.match(generator, /const INTERNAL_ERASE_STROKE = 12/);
  assert.match(generator, /const OUTLINE_STROKE = 18/);
  assert.doesNotMatch(
    generator,
    /splitSegmentsAtRegionVertices|stitchBoundaryLoops|pointOnSegment|edgeKey/,
  );
  assert.doesNotMatch(generator, /MutationObserver|requestAnimationFrame|pointermove/);
});

test("regional mask erases seams between territories before the outline is shown", () => {
  assert.match(generator, /<rect[^>]*fill="#fff"/);
  assert.match(
    generator,
    /<use href="#region-shape-\$\{region\}" fill="#000" stroke="#000"/,
  );
  assert.match(generator, /stroke-width="\$\{INTERNAL_ERASE_STROKE\}"/);
  assert.match(generator, /stroke-width="\$\{OUTLINE_STROKE\}"/);
  assert.match(generator, /pointer-events="none"/);
});

test("region colors live on group silhouettes instead of individual territory borders", () => {
  assert.doesNotMatch(visualState, /--territory-region-stroke/);
  assert.doesNotMatch(visualState, /\.territory\[data-region=/);
  assert.match(visualState, /stroke:\s*#d9d2bd/);
  assert.match(visualState, /stroke-opacity:\s*\.3/);

  assert.match(generator, /norte:\s*"#67f58b"/);
  assert.match(generator, /nordeste:\s*"#63b4ff"/);
  assert.match(generator, /"centro-oeste":\s*"#ffd84d"/);
  assert.match(generator, /sudeste:\s*"#ff6262"/);
  assert.match(generator, /sul:\s*"#ff9a3d"/);
});

test("development and production generate silhouettes before serving the map", () => {
  assert.match(packageJson.scripts.dev, /^node scripts\/generate-region-outlines\.mjs && /);
  assert.match(packageJson.scripts.build, /^node scripts\/generate-region-outlines\.mjs && /);
  assert.equal(packageJson.scripts["map:regions"], "node scripts/generate-region-outlines.mjs");
});
