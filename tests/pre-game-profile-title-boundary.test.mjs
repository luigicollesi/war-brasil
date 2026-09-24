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
  const design = read("src/lib/profile/title-design.ts");
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
    assert.ok(design.includes('getTitleStyleEffect(visual, "' + effect + '")'));
  }

  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(effects, /@property --profile-title-angle/);
  assert.match(effects, /@keyframes wb-title-sheen-overlay/);
  assert.match(styles, /color-mix\(/);
  assert.doesNotMatch(renderer, /STYLE_CLASS/);
});


test("title gradient auras support glow and halo but never gradient shadow", () => {
  const resolver = read("src/lib/profile/title-style.ts");
  const design = read("src/lib/profile/title-design.ts");
  const renderer = read("src/components/profile/profile-title-renderer.tsx");
  const styles = read("src/components/profile/profile-title-renderer.module.css");
  const effects = read("src/app/title-effects.css");

  assert.match(resolver, /GRADIENT_AURA_EFFECTS/);
  assert.match(resolver, /new Set<TitleEffectKind>\(\["glow", "halo"\]\)/);
  assert.match(resolver, /paletteTo: TitlePaletteKey \| null/);
  assert.match(resolver, /Gradient shadows and other gradient effects are intentionally unsupported/);
  assert.match(resolver, /"drift"/);
  assert.match(resolver, /"rotate"/);
  assert.match(resolver, /"cycle"/);
  assert.match(resolver, /validateTitleStyleKeyForCatalog/);

  assert.match(design, /resolveCommanderTitleDesign/);
  assert.match(design, /gradientAura/);
  assert.match(renderer, /styles\.glowAura/);
  assert.match(renderer, /styles\.haloAura/);
  assert.match(renderer, /aria-hidden="true"/);
  assert.match(styles, /data-aura-motion="drift"/);
  assert.match(styles, /data-aura-motion="rotate"/);
  assert.match(styles, /data-aura-motion="cycle"/);
  assert.match(effects, /@keyframes wb-title-aura-drift/);
  assert.match(effects, /@keyframes wb-title-aura-rotate/);
  assert.match(effects, /@keyframes wb-title-aura-cycle/);
});

test("title design still comes directly from catalog appearance columns", () => {
  const repository = read(
    "src/lib/server/profile/profile-appearance-repository.ts",
  );
  const service = read("src/lib/server/profile/profile-appearance-service.ts");
  const renderer = read("src/components/profile/profile-title-renderer.tsx");

  assert.match(repository, /title\.display_text/);
  assert.match(repository, /title\.rarity/);
  assert.match(repository, /title\.font_key/);
  assert.match(repository, /title\.style_key/);
  assert.match(repository, /title\.texture_ref/);
  assert.match(service, /fontKey: row\.font_key/);
  assert.match(service, /styleKey: row\.style_key/);
  assert.match(renderer, /resolveCommanderTitleDesign\(title\)/);
});


test("gradient aura layers do not inherit the title's solid shadow stack", () => {
  const styles = read("src/components/profile/profile-title-renderer.module.css");

  const auraStart = styles.indexOf(".auraLayer");
  const glowStart = styles.indexOf(".glowAura", auraStart);
  assert.ok(auraStart >= 0 && glowStart > auraStart);

  const auraBlock = styles.slice(auraStart, glowStart);
  assert.match(auraBlock, /text-shadow:\s*none/);
  assert.match(auraBlock, /-webkit-text-stroke:\s*0/);
});


test("sheen keeps the base material fully painted and resets only while invisible", () => {
  const renderer = read("src/components/profile/profile-title-renderer.tsx");
  const styles = read("src/components/profile/profile-title-renderer.module.css");
  const effects = read("src/app/title-effects.css");

  assert.match(renderer, /data-title-text=\{title\.displayText\}/);
  assert.match(styles, /\.title::after[\s\S]*content: attr\(data-title-text\)/);
  assert.match(
    styles,
    /\.title\[data-motion="sheen"\]::after[\s\S]*wb-title-sheen-overlay 7\.5s linear infinite/,
  );

  const sheenStart = styles.indexOf('.title[data-motion="sheen"]::after');
  const pulseStart = styles.indexOf('.title[data-motion="pulse"]', sheenStart);
  assert.ok(sheenStart >= 0 && pulseStart > sheenStart);
  const sheenBlock = styles.slice(sheenStart, pulseStart);
  assert.doesNotMatch(
    sheenBlock,
    /--profile-title-fill-image|--profile-title-fill-size|--profile-title-motion-animation/,
  );

  const keyframeStart = effects.indexOf("@keyframes wb-title-sheen-overlay");
  const pulseKeyframe = effects.indexOf("@keyframes wb-title-pulse", keyframeStart);
  assert.ok(keyframeStart >= 0 && pulseKeyframe > keyframeStart);
  const keyframe = effects.slice(keyframeStart, pulseKeyframe);
  assert.match(keyframe, /0%,[\s\S]*15%[\s\S]*opacity: 0/);
  assert.match(keyframe, /68%,[\s\S]*100%[\s\S]*opacity: 0/);
  assert.match(keyframe, /background-position: 130% 50%/);
  assert.match(keyframe, /background-position: -30% 50%/);
});

test("open title sweeps alternate instead of jumping back to the first frame", () => {
  const styles = read("src/components/profile/profile-title-renderer.module.css");

  assert.match(
    styles,
    /data-motion="flow"[\s\S]*wb-title-flow 8s ease-in-out infinite alternate/,
  );

  const effects = read("src/app/title-effects.css");
  assert.match(
    effects,
    /@keyframes wb-title-flow[\s\S]*--profile-title-fill-x: 0%[\s\S]*--profile-title-fill-x: 100%/,
  );
  assert.doesNotMatch(
    effects,
    /@keyframes wb-title-flow[\s\S]{0,180}--profile-title-fill-x: -(?:\d+)%/,
  );
  assert.doesNotMatch(
    effects,
    /@keyframes wb-title-flow[\s\S]{0,180}--profile-title-fill-x: 1(?:0[1-9]|[1-9]\d)%/,
  );
  assert.match(
    styles,
    /data-sparkle-motion="flow"[\s\S]*wb-title-sparkle-flow 9s ease-in-out infinite alternate/,
  );
  assert.match(
    styles,
    /data-ember-motion="flow"[\s\S]*wb-title-ember-flow 8\.4s ease-in-out infinite alternate/,
  );
  assert.match(
    styles,
    /data-aura-motion="cycle"[\s\S]*wb-title-aura-cycle 8\.5s ease-in-out infinite alternate/,
  );
});

test("reduced motion and forced colors also disable transient sheen overlays", () => {
  const styles = read("src/components/profile/profile-title-renderer.module.css");

  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.title::after[\s\S]*animation: none !important/,
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.title::after[\s\S]*opacity: 0 !important/,
  );
  assert.match(
    styles,
    /@media \(forced-colors: active\)[\s\S]*\.title::after[\s\S]*display: none/,
  );
});


test("gradient drift loops from the same visual state without moving glyph geometry", () => {
  const styles = read("src/components/profile/profile-title-renderer.module.css");
  const effects = read("src/app/title-effects.css");

  assert.match(
    styles,
    /data-motion="drift"[\s\S]*wb-title-gradient-drift 12s ease-in-out infinite/,
  );
  assert.doesNotMatch(
    styles,
    /data-motion="drift"[\s\S]{0,180}infinite alternate/,
  );
  assert.match(
    styles,
    /data-aura-motion="drift"[\s\S]*wb-title-aura-drift 10s ease-in-out infinite/,
  );

  assert.match(
    effects,
    /@keyframes wb-title-gradient-drift[\s\S]*0%,[\s\S]*100%[\s\S]*--profile-title-fill-x: 50%[\s\S]*--profile-title-fill-y: 50%/,
  );
  assert.match(
    effects,
    /@keyframes wb-title-aura-drift[\s\S]*0%,[\s\S]*100%[\s\S]*background-position: 50% 50%/,
  );
  assert.doesNotMatch(effects, /@keyframes wb-title-angle-drift/);
  assert.doesNotMatch(
    effects,
    /@keyframes wb-title-gradient-drift[\s\S]{0,500}--profile-title-angle:/,
  );
});


test("title rarity controls size centrally across profile surfaces", () => {
  const rendererStyles = read("src/components/profile/profile-title-renderer.module.css");
  const dossierStyles = read("src/components/profile/v4/profile-dossier.module.css");
  const publicStyles = read("src/components/profile/public-commander-profile.module.css");

  for (const rarity of ["common", "uncommon", "rare", "epic", "legendary"]) {
    assert.ok(rendererStyles.includes('data-title-rarity="' + rarity + '"'));
  }

  assert.match(rendererStyles, /--profile-title-size-legendary/);
  assert.match(rendererStyles, /data-title-rarity="legendary"[\s\S]*font-size:\s*var\(--profile-title-size-legendary\)/);
  assert.match(rendererStyles, /data-title-rarity="epic"[\s\S]*calc\(var\(--profile-title-size-legendary\) - 0\.28rem\)/);
  assert.match(dossierStyles, /--profile-title-size-legendary:\s*clamp\(2rem, 4\.2vw, 4\.8rem\)/);
  assert.match(publicStyles, /--profile-title-size-legendary:\s*clamp\(3\.9rem, 7\.1vw, 8\.8rem\)/);
  assert.doesNotMatch(dossierStyles, /\.dossierTitle\s*\{[^}]*font-size:/s);
  assert.doesNotMatch(publicStyles, /\.title\s*\{[^}]*font-size:/s);
});
