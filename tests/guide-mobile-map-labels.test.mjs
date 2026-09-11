import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const geographicCss = readFileSync("src/app/war-guide-geographic.css", "utf8");
const mobileMapCss = readFileSync("src/app/war-guide-mobile-map.css", "utf8");

test("mobile guide map labels override the legacy light-label styling", () => {
  assert.match(
    mobileMapCss,
    /\.wb-guide-map-territory-name\s*\{[\s\S]*?fill:\s*#050505;[\s\S]*?stroke:\s*none;[\s\S]*?font-size:\s*17px;/,
  );
});

test("desktop guide map labels preserve the established styling", () => {
  const mobileStart = geographicCss.indexOf("@media (max-width: 700px)");
  const desktopCss = mobileStart >= 0 ? geographicCss.slice(0, mobileStart) : geographicCss;

  assert.match(
    desktopCss,
    /\.wb-guide-map-territory-name\s*\{[\s\S]*?font-size:\s*15px;[\s\S]*?stroke-width:\s*4px;/,
  );
});
