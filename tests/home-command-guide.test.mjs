import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guide = readFileSync(
  "src/components/pre-game/home/command-home-guide.tsx",
  "utf8",
);
const guideStyles = readFileSync(
  "src/components/pre-game/home/command-home-guide.module.css",
  "utf8",
);
const home = readFileSync(
  "src/components/pre-game/home/command-home-client.tsx",
  "utf8",
);
const homeStyles = readFileSync(
  "src/components/pre-game/home/command-home.module.css",
  "utf8",
);

test("home guide keeps the canonical four-step destination order", () => {
  const operations = guide.indexOf('id: "operations"');
  const doctrine = guide.indexOf('id: "doctrine"');
  const profile = guide.indexOf('id: "profile"');
  const campaign = guide.indexOf('id: "campaign"');

  assert.ok(operations >= 0);
  assert.ok(doctrine > operations);
  assert.ok(profile > doctrine);
  assert.ok(campaign > profile);
  assert.match(home, /data-destination={destination\.id}/);
});

test("home guide is an accessible modal portal with inert background and focus restoration", () => {
  assert.match(guide, /createPortal/);
  assert.match(guide, /role="dialog"/);
  assert.match(guide, /aria-modal="true"/);
  assert.match(guide, /aria-labelledby="home-guide-title"/);
  assert.match(guide, /aria-describedby="home-guide-description"/);
  assert.match(guide, /homeRoot\?\.setAttribute\("inert", ""\)/);
  assert.match(guide, /homeRoot\.removeAttribute\("inert"\)/);
  assert.match(guide, /event\.key === "Escape"/);
  assert.match(guide, /event\.key !== "Tab"/);
  assert.match(guide, /returnFocusRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(guide, /aria-hidden.*body|document\.body\.setAttribute\("aria-hidden"/);
});

test("spotlight measures only discrete layout events and cleans observers", () => {
  assert.match(guide, /getBoundingClientRect\(\)/);
  assert.match(guide, /new ResizeObserver\(scheduleMeasure\)/);
  assert.match(guide, /requestAnimationFrame\(measureTarget\)/);
  assert.match(guide, /observer\?\.disconnect\(\)/);
  assert.match(guide, /removeEventListener\("resize"/);
  assert.match(guide, /removeEventListener\("orientationchange"/);
  assert.doesNotMatch(guide, /setInterval\(/);
  assert.doesNotMatch(guide, /requestAnimationFrame\([^)]*requestAnimationFrame/s);
});

test("guide launcher is command-home only, accessible and at least 40px", () => {
  assert.match(home, /isCommandHome &&[\s\S]*commandOpen/);
  assert.match(home, /aria-label="Abrir guia da tela inicial"/);
  assert.match(home, /type="button"[\s\S]*className={styles\.guideLauncher}/);
  assert.match(homeStyles, /\.guideLauncher\s*\{[\s\S]*width:\s*42px;[\s\S]*height:\s*42px;/);
  assert.match(homeStyles, /\.guideLauncher:focus-visible/);
});

test("guide blocks hidden target interaction without z-index mutation and supports reduced motion", () => {
  assert.match(guide, /className={styles\.maskPanel}/);
  assert.match(guide, /className={styles\.spotlightFrame}/);
  assert.match(guideStyles, /\.maskPanel\s*\{[\s\S]*pointer-events:\s*auto/);
  assert.match(guideStyles, /\.spotlightFrame\s*\{[\s\S]*pointer-events:\s*none/);
  assert.match(guideStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(guide, /target\.style\.zIndex|style\.zIndex/);
});

test("guide lifecycle remains separate from blocking home modals and route transition", () => {
  assert.match(home, /!onboardingOpen/);
  assert.match(home, /!betaTesterRewardPending/);
  assert.match(home, /!authModalOpen/);
  assert.match(home, /!commandHomeNavigationPending/);
  assert.match(home, /transitioningTo === null/);
  assert.match(home, /guideOpen\s*\?\s*"guide"/);
  assert.match(home, /<CommandHomeGuide/);
});
