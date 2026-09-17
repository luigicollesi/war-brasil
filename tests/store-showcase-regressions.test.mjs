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

test("showcase owns its chrome and keeps the object slightly farther on desktop", () => {
  assert.match(runtime, /pathname\.startsWith\("\/profile\/store\/showcase\/"\)/);
  assert.match(controller, /const DESKTOP_SHOWCASE_SCALE = 0\.92/);
  assert.match(controller, /state\.size\.width > 900/);
  assert.match(controller, /group\.scale\.setScalar\(viewScale\)/);
});

test("showcase dice reads catalog body_color and includes it in texture identity", () => {
  assert.match(metadataRepository, /SELECT body_color/);
  assert.match(metadataRepository, /FROM catalog\.cosmetics/);
  assert.match(metadataRepository, /asset_ref=\$1/);
  assert.match(metadataRepository, /slot=\$2/);

  assert.match(bodyColorHook, /\/api\/assets\/dice\/metadata/);
  assert.match(model, /useDiceBodyColor\(assetRef, slot\)/);
  assert.match(model, /bodyColor,/);
  assert.match(textureHook, /bodyColor/);
  assert.match(textureManager, /options\.bodyColor \?\? "default-body"/);
});

test("dice face paints body_color below transparent cosmetic artwork", () => {
  const baseColorIndex = textureCreator.indexOf(
    "drawBodyColor(context, resolution, resolvedBodyColor)",
  );
  const artworkIndex = textureCreator.indexOf(
    "context.drawImage(image, 0, 0, resolution, resolution)",
  );

  assert.ok(baseColorIndex >= 0, "body color base was not drawn");
  assert.ok(artworkIndex >= 0, "cosmetic artwork was not drawn");
  assert.ok(
    baseColorIndex < artworkIndex,
    "body color must be painted before transparent cosmetic artwork",
  );
  assert.match(textureCreator, /BODY_COLOR_PATTERN = \/\^#\[0-9a-f\]\{6\}\$\/i/);
});

test("3d texture delivery stays same-origin instead of redirecting the browser to R2", () => {
  for (const route of [diceRoute, territoryRoute]) {
    assert.match(route, /const upstream = await fetch\(location/);
    assert.match(route, /return proxiedAssetResponse\(upstream\)/);
    assert.doesNotMatch(route, /status:\s*307/);
    assert.doesNotMatch(route, /Location:\s*location/);
  }
});
