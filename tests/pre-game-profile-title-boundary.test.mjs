import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("title API derives the actor from session and never accepts browser userId", () => {
  const route = read("src/app/api/profile/titles/route.ts");
  const service = read("src/lib/server/profile/profile-title-service.ts");

  assert.match(route, /getAuthenticatedSessionForRead\(request\)/);
  assert.match(route, /listOwnedCommanderTitles\(session\.user\.id\)/);
  assert.match(route, /requireProfileMutationActor\(request\)/);
  assert.match(route, /equipOwnedCommanderTitle\(actor\.userId, titleId\)/);
  assert.doesNotMatch(route, /payload\.userId/);
  assert.doesNotMatch(service, /input\.userId/);
});

test("title selection accepts only titleId and supports explicit unequip", () => {
  const service = read("src/lib/server/profile/profile-title-service.ts");

  assert.match(service, /keys\.length !== 1 \|\| keys\[0\] !== "titleId"/);
  assert.match(service, /if \(input\.titleId === null\) return null/);
  assert.match(service, /TITLE_ID_MAX_LENGTH = 128/);
});

test("equip checks active ownership before updating the authenticated commander", () => {
  const service = read("src/lib/server/profile/profile-title-service.ts");
  const migration = read(
    "src/lib/db/migrations/managed/034-profile-v3-foundation.sql",
  );

  assert.match(
    service,
    /FROM profile\.commander_titles owned[\s\S]*JOIN catalog\.commander_titles title[\s\S]*owned\.user_id=\$1::uuid[\s\S]*owned\.title_id=\$2[\s\S]*title\.is_active=TRUE/,
  );
  assert.match(
    service,
    /UPDATE profile\.commanders[\s\S]*SET equipped_title_id=\$2[\s\S]*WHERE user_id=\$1::uuid/,
  );
  assert.match(migration, /commanders_equipped_title_owned_fkey/);
  assert.match(
    migration,
    /FOREIGN KEY \(user_id, equipped_title_id\)[\s\S]*REFERENCES profile\.commander_titles\(user_id, title_id\)/,
  );
});

test("settings UI loads owned appearance on demand and mutates title through the unified appearance API", () => {
  const panel = read(
    "src/components/profile/command-quarters/profile-settings-panel.tsx",
  );

  assert.match(panel, /fetch\("\/api\/profile\/appearance"/);
  assert.match(panel, /void loadAppearance\(\)/);
  assert.match(panel, /method: "PATCH"/);
  assert.match(panel, /payload\.titleId = selectedTitleId/);
  assert.match(panel, /appearanceView === "titles"/);
  assert.match(panel, /ProfileTitleRenderer/);
  assert.doesNotMatch(panel, /\/api\/profile\/titles/);
  assert.doesNotMatch(panel, /const .*TITLES.*=\s*\[/i);
});

test("title font keys resolve to self-hosted Next font variables with safe fallback", () => {
  const fonts = read("src/app/fonts.ts");
  const layout = read("src/app/layout.tsx");
  const renderer = read("src/components/profile/profile-title-renderer.tsx");
  const styles = read("src/components/profile/profile-title-renderer.module.css");

  for (const loader of [
    "Black_Ops_One",
    "Cinzel",
    "Oxanium",
    "Bebas_Neue",
    "Cormorant_SC",
  ]) {
    assert.match(fonts, new RegExp("\\b" + loader + "\\b"));
  }

  assert.equal((fonts.match(/preload:\s*false/g) ?? []).length, 5);
  assert.match(layout, /profileTitleFontVariables/);

  for (const key of [
    "command-display",
    "command-mono",
    "military-stencil",
    "imperial",
    "tactical-tech",
    "propaganda",
    "ceremonial",
  ]) {
    assert.ok(renderer.includes('"' + key + '"') || renderer.includes(key + ":"));
  }

  for (const variable of [
    "--font-wb-title-military-stencil",
    "--font-wb-title-imperial",
    "--font-wb-title-tactical-tech",
    "--font-wb-title-propaganda",
    "--font-wb-title-ceremonial",
  ]) {
    assert.ok(fonts.includes(variable));
    assert.ok(styles.includes("var(" + variable + ")"));
  }

  assert.match(
    renderer,
    /return FONT_CLASS\[fontKey\] \?\? styles\.commandDisplay/,
  );
  assert.match(renderer, /stencil: styles\.militaryStencil/);
  assert.match(renderer, /serif: styles\.serif/);
});

test("title style keys use a composable allow-listed visual grammar", () => {
  const resolver = read("src/lib/profile/title-style.ts");
  const renderer = read("src/components/profile/profile-title-renderer.tsx");
  const styles = read("src/components/profile/profile-title-renderer.module.css");
  const effects = read("src/app/title-effects.css");

  assert.match(resolver, /TITLE_STYLE_MAX_LENGTH = 48/);
  assert.match(resolver, /export const TITLE_PALETTES/);
  assert.match(resolver, /export const TITLE_MATERIALS/);
  assert.match(resolver, /export const TITLE_MOTIONS/);
  assert.match(resolver, /export const TITLE_EFFECT_KINDS/);
  assert.match(resolver, /parseTitleStyleKey/);
  assert.match(resolver, /titleStyleCssVariables/);
  assert.match(resolver, /rarityCompatible/);

  for (const legacy of [
    "standard",
    "imperial-gold",
    "blood-command",
    "silver-steel",
    "night-sky",
  ]) {
    assert.ok(resolver.includes('"' + legacy + '"') || resolver.includes(legacy + ":"));
  }

  for (const material of [
    "solid",
    "matte",
    "metal",
    "satin",
    "crystal",
    "pearl",
    "neon",
    "ember",
    "frost",
    "aurora",
    "holo",
    "void",
  ]) {
    assert.ok(styles.includes('data-material="' + material + '"'));
  }

  for (const motion of [
    "drift",
    "sheen",
    "pulse",
    "shimmer",
    "wave",
    "flow",
    "flicker",
  ]) {
    assert.ok(styles.includes('data-motion="' + motion + '"'));
  }

  for (const effect of [
    "outline",
    "shadow",
    "glow",
    "halo",
    "sparkle",
    "ember",
  ]) {
    assert.ok(renderer.includes('getTitleStyleEffect(visual, "' + effect + '")'));
  }

  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(effects, /@property --profile-title-angle/);
  assert.match(effects, /@keyframes wb-title-sheen/);
  assert.match(styles, /color-mix\(/);
  assert.doesNotMatch(renderer, /STYLE_CLASS/);
});
