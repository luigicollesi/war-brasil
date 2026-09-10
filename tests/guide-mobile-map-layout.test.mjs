import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mobileMapCss = readFileSync("src/app/war-guide-mobile-map.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");

test("mobile guide labels use light fill with a dark outline", () => {
  assert.match(
    mobileMapCss,
    /\.wb-guide-map-territory-name\s*\{[\s\S]*?fill:\s*#fff8e8;[\s\S]*?stroke:\s*#06140f;[\s\S]*?stroke-opacity:\s*1;[\s\S]*?stroke-width:\s*2px;[\s\S]*?paint-order:\s*stroke fill;/,
  );
});

test("Leia o mapa mirrors the mobile troop counter contrast", () => {
  assert.match(
    mobileMapCss,
    /\.wb-guide-map-frame--reading \.wb-guide-map-troop-markers circle\s*\{[\s\S]*?fill:\s*#f3efe4;[\s\S]*?stroke:\s*#176b46;[\s\S]*?stroke-width:\s*2px;/,
  );
  assert.match(
    mobileMapCss,
    /\.wb-guide-map-frame--reading \.wb-guide-map-troop-markers text\s*\{[\s\S]*?fill:\s*#17201c;[\s\S]*?stroke:\s*none;[\s\S]*?font-size:\s*19px;/,
  );
});

test("Leia o mapa has mobile-only spacing for labels, troops and road", () => {
  assert.match(mobileMapCss, /territory-name\[x="721"\]/);
  assert.match(mobileMapCss, /territory-name\[x="788"\]/);
  assert.match(mobileMapCss, /troop-markers > g:nth-child\(2\) > \*/);
  assert.match(mobileMapCss, /troop-markers > g:nth-child\(3\) > \*/);
  assert.match(mobileMapCss, /\.wb-guide-map-road-shadow\s*\{[\s\S]*?stroke-width:\s*9;/);
  assert.match(mobileMapCss, /\.wb-guide-map-selected-territory\s*\{[\s\S]*?stroke-width:\s*6;/);
});

test("mobile map overrides load after the general responsive guide styles", () => {
  const responsiveIndex = layout.indexOf('import "./war-guide-responsive.css";');
  const mobileMapIndex = layout.indexOf('import "./war-guide-mobile-map.css";');
  assert.ok(responsiveIndex >= 0 && mobileMapIndex > responsiveIndex);
});
