import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const runtime = read(
  "src/components/pre-game/foundation/pre-game-command-runtime.tsx",
);
const controller = read(
  "src/components/profile/v4/store-showcase/showcase-object-controller.tsx",
);
const showcase = read(
  "src/components/profile/v4/store-showcase/store-showcase.tsx",
);
const showcaseStyles = read(
  "src/components/profile/v4/store-showcase/store-showcase.module.css",
);
const model = read(
  "src/components/profile/v4/store-showcase/dice-showcase-model.tsx",
);
const diceModel = read("src/components/dice-3d/dice-model-3d.tsx");
const textureHook = read("src/components/dice-3d/use-dice-face-textures.ts");
const textureManager = read("src/lib/client/dice/dice-assets-manager.ts");
const textureCreator = read(
  "src/lib/client/dice/textures/create-face-texture.ts",
);
const diceRoute = read("src/app/api/assets/dice/route.ts");
const territoryRoute = read("src/app/api/assets/territory-skins/route.ts");
const assetFallback = read("src/lib/server/assets/asset-fallback-route.ts");

test("showcase owns its chrome and derives object scale from the presentation contract", () => {
  const presentation = read(
    "src/lib/client/store-showcase/showcase-presentation.ts",
  );

  assert.match(runtime, /pathname\.startsWith\("\/profile\/store\/showcase\/"\)/);
  assert.match(controller, /viewportSize\.width <= 900/);
  assert.match(
    controller,
    /resolveShowcasePresentation\(\s*objectType,\s*compact,\s*viewportAspect,\s*\)/,
  );
  assert.match(controller, /group\.scale\.setScalar\(presentation\.objectScale\)/);
  assert.match(presentation, /territory:\s*\{/);
  assert.doesNotMatch(controller, /DESKTOP_SHOWCASE_SCALE/);
});

test("showcase dice carries catalog colors in the DTO without a metadata round trip", () => {
  const projection = read("src/lib/economy/store-showcase.ts");
  assert.match(projection, /bodyColor: item\.bodyColor/);
  assert.match(projection, /bodyHighlightColor: item\.bodyHighlightColor/);
  assert.match(showcase, /bodyColor=\{item\.bodyColor\}/);
  assert.match(showcase, /bodyHighlightColor=\{item\.bodyHighlightColor\}/);
  assert.match(model, /bodyColor: string \| null/);
  assert.match(model, /bodyHighlightColor: string \| null/);
  assert.doesNotMatch(model, /\/api\/assets\/dice\/metadata|useDiceBodyColor/);
  assert.match(diceModel, /resolveDiceBodyColors\(bodyColor, bodyHighlightColor\)/);
  assert.match(diceModel, /diceBodyColor/);
  assert.match(diceModel, /diceBodyHighlightColor/);
  assert.match(textureHook, /bodyColor/);
  assert.match(textureManager, /options\.bodyColor \?\? "default-body"/);
});

test("dice face preserves cosmetic alpha so the shader reveals the physical body", () => {
  assert.doesNotMatch(textureCreator, /drawBodyColor/);
  assert.match(textureCreator, /image\.crossOrigin = "anonymous"/);
  assert.match(
    textureCreator,
    /context\.drawImage\(image, 0, 0, resolution, resolution\)/,
  );
  assert.match(textureCreator, /BODY_COLOR_PATTERN = \/\^#\[0-9a-f\]\{6\}\$\/i/);

  assert.match(diceModel, /float diceArtworkAlpha = diffuseColor\.a/);
  assert.match(
    diceModel,
    /diffuseColor\.rgb = mix\(diceBodySurfaceColor, diceArtworkColor, diceArtworkAlpha\)/,
  );
});

test("legacy asset routes share a same-origin fallback while production uses the CDN", () => {
  for (const route of [diceRoute, territoryRoute]) {
    assert.match(route, /serveAuthenticatedAssetFallback/);
  }
  assert.match(assetFallback, /const upstream = await fetch\(location/);
  assert.match(assetFallback, /return proxiedAssetResponse\(upstream\)/);
  assert.doesNotMatch(assetFallback, /status:\s*307/);
  assert.doesNotMatch(assetFallback, /Location:\s*location/);
});


test("showcase keeps a bounded current-plus-target WebGL scene instead of parking the full catalogue", () => {
  assert.match(showcase, /key:\s*showcase\.id,/);
  assert.doesNotMatch(showcase, /key:\s*selectedItem\?\.id/);
  assert.match(showcase, /const activeSceneItems = useMemo/);
  assert.match(showcase, /transitionPhase !== "slide"/);
  assert.match(showcase, /transitionTargetItem\.id === selectedItem\.id/);
  assert.match(showcase, /activeSceneItems\.map\(\(\{ item, itemIndex \}\) => \(/);
  assert.match(
    showcase,
    /<ShowcaseObjectController[\s\S]*key=\{item\.id\}[\s\S]*itemId=\{item\.id\}[\s\S]*itemIndex=\{itemIndex\}/,
  );
  assert.doesNotMatch(
    showcase,
    /showcase\.items\.map\(\(item, itemIndex\) =>\s*\(\s*<ShowcaseObjectController/s,
  );
  assert.match(showcase, /transitionTargetItemId=\{transitionTargetItemId\}/);
  assert.match(controller, /const SHOWCASE_STANDBY_X = 8;/);
  assert.match(controller, /const isSelected = itemId === selectedItemId;/);
  assert.match(controller, /const isTarget = itemId === transitionTargetItemId;/);

  assert.match(showcaseStyles, /\.root\s*\{[^}]*overflow:\s*hidden;/);
  assert.match(showcaseStyles, /\.stage\s*\{[^}]*overflow:\s*hidden;/);
});

test("showcase carousel moves current and target simultaneously during one slide", () => {
  assert.match(
    controller,
    /if \(transitionPhase === "slide" && isSelected\)[\s\S]*-transitionDirection \* SHOWCASE_STANDBY_X \* progress/,
  );
  assert.match(
    controller,
    /if \(transitionPhase === "slide" && isTarget\)[\s\S]*transitionDirection \* SHOWCASE_STANDBY_X \* \(1 - progress\)/,
  );
  assert.match(
    controller,
    /if \(!isSelected && !isTarget\) return;/,
  );
});

test("showcase keeps failed territory models isolated per mounted item", () => {
  assert.match(showcase, /failedTerritoryItemIds/);
  assert.match(showcase, /new Set\(current\)/);
  assert.match(showcase, /failedTerritoryItemIds\.has\(item\.id\)/);
});
