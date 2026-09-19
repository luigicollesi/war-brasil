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
const model = read(
  "src/components/profile/v4/store-showcase/dice-showcase-model.tsx",
);
const diceModel = read("src/components/dice-3d/dice-model-3d.tsx");
const bodyColorHook = read(
  "src/components/profile/v4/store-showcase/use-dice-body-color.ts",
);
const textureHook = read("src/components/dice-3d/use-dice-face-textures.ts");
const textureManager = read("src/lib/client/dice/dice-assets-manager.ts");
const textureCreator = read(
  "src/lib/client/dice/textures/create-face-texture.ts",
);
const metadataRepository = read(
  "src/lib/server/assets/dice-asset-metadata-repository.ts",
);
const diceRoute = read("src/app/api/assets/dice/route.ts");
const territoryRoute = read("src/app/api/assets/territory-skins/route.ts");

test("showcase owns its chrome and derives object scale from the presentation contract", () => {
  const presentation = read(
    "src/lib/client/store-showcase/showcase-presentation.ts",
  );

  assert.match(runtime, /pathname\.startsWith\("\/profile\/store\/showcase\/"\)/);
  assert.match(controller, /state\.size\.width <= 900/);
  assert.match(controller, /resolveShowcasePresentation\(objectType, compact\)/);
  assert.match(controller, /group\.scale\.setScalar\(presentation\.objectScale\)/);
  assert.match(presentation, /territory:\s*\{/);
  assert.doesNotMatch(controller, /DESKTOP_SHOWCASE_SCALE/);
});

test("showcase dice reads catalog body_color and applies it to texture and physical body", () => {
  assert.match(metadataRepository, /SELECT body_color/);
  assert.match(metadataRepository, /FROM catalog\.cosmetics/);
  assert.match(metadataRepository, /asset_ref=\$1/);
  assert.match(metadataRepository, /slot=\$2/);

  assert.match(bodyColorHook, /\/api\/assets\/dice\/metadata/);
  assert.match(model, /useDiceBodyColor\(assetRef, slot\)/);
  assert.match(model, /bodyColor,?/);
  assert.match(model, /bodyColor=\{bodyColor\}/);
  assert.match(diceModel, /bodyColor\?: string \| null/);
  assert.match(diceModel, /resolveDiceBodyColors\(bodyColor, bodyHighlightColor\)/);
  assert.match(diceModel, /diceBodyColor/);
  assert.match(diceModel, /diceBodyHighlightColor/);
  assert.match(textureHook, /bodyColor/);
  assert.match(textureManager, /options\.bodyColor \?\? "default-body"/);
});

test("dice face preserves cosmetic alpha so the shader reveals the physical body", () => {
  assert.doesNotMatch(textureCreator, /drawBodyColor/);
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

test("3d texture delivery stays same-origin instead of redirecting the browser to R2", () => {
  for (const route of [diceRoute, territoryRoute]) {
    assert.match(route, /const upstream = await fetch\(location/);
    assert.match(route, /return proxiedAssetResponse\(upstream\)/);
    assert.doesNotMatch(route, /status:\s*307/);
    assert.doesNotMatch(route, /Location:\s*location/);
  }
});


test("showcase item transition exits opposite to navigation and enters from navigation direction", () => {
  assert.match(
    controller,
    /else if \(transitionPhase === "enter"\) \{[^}]*group\.position\.x = transitionDirection \* 0\.32;/,
  );
  assert.match(
    controller,
    /if \(transitionPhase === "exit"\) \{[^}]*group\.position\.x = -transitionDirection \* 0\.32 \* progress;/,
  );
  assert.match(
    controller,
    /\} else \{[^}]*group\.position\.x =\s*transitionDirection \* 0\.32 \* \(1 - progress\);/,
  );
});
