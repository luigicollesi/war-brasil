import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("src/app/war-guide-geographic.css", "utf8");

test("mobile guide map labels keep a thin outline for readability", () => {
  const mobileStart = css.indexOf("@media (max-width: 700px)");
  assert.ok(mobileStart >= 0, "mobile guide breakpoint is missing");

  const mobileCss = css.slice(mobileStart);
  assert.match(
    mobileCss,
    /\.wb-guide-map-territory-name\s*\{[\s\S]*?font-size:\s*14px;[\s\S]*?letter-spacing:\s*\.02em;[\s\S]*?paint-order:\s*stroke fill;[\s\S]*?stroke-width:\s*1\.5px;/,
  );
});

test("desktop guide map labels preserve the established styling", () => {
  const mobileStart = css.indexOf("@media (max-width: 700px)");
  const desktopCss = css.slice(0, mobileStart);

  assert.match(
    desktopCss,
    /\.wb-guide-map-territory-name\s*\{[\s\S]*?font-size:\s*15px;[\s\S]*?stroke-width:\s*4px;/,
  );
});
