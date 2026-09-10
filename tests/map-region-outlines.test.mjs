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

test("region outlines are generated from the 42 canonical face masks", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/generate-region-outlines.mjs", "--check"],
    { encoding: "utf8" },
  );

  assert.equal(
    result.status,
    0,
    `region outline generator failed:\n${result.stderr || result.stdout}`,
  );
  assert.match(result.stdout, /Region outlines ready:/);
  for (const region of REGIONS) assert.match(result.stdout, new RegExp(`${region}=`));
});

test("region outline layer is static, non-interactive and contains one path per region", () => {
  assert.match(generator, /id="region-outlines"/);
  assert.match(generator, /pointer-events="none"/);
  assert.match(generator, /fill="none"/);
  assert.match(generator, /stroke-width="3"/);
  assert.match(generator, /vector-effect="non-scaling-stroke"/);
  assert.match(generator, /REGION_ORDER\.map/);
  assert.doesNotMatch(generator, /MutationObserver|requestAnimationFrame|pointermove/);
});

test("region colors live on group outlines instead of individual territory borders", () => {
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

test("development and production generate outlines before serving the map", () => {
  assert.match(packageJson.scripts.dev, /^node scripts\/generate-region-outlines\.mjs && /);
  assert.match(packageJson.scripts.build, /^node scripts\/generate-region-outlines\.mjs && /);
  assert.equal(packageJson.scripts["map:regions"], "node scripts/generate-region-outlines.mjs");
});
