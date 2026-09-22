import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("skin cosmética altera somente a fonte visual das texturas 3D", () => {
  const types = source("src/lib/client/dice/types.ts");
  const texture = source("src/lib/client/dice/textures/create-face-texture.ts");
  const assets = source("src/lib/client/dice/dice-assets-manager.ts");
  const launch = source(
    "src/lib/client/dice/physics/create-dice-launch-plan.ts",
  );
  const predetermined = source(
    "src/lib/client/dice/physics/build-predetermined-roll.ts",
  );

  assert.match(types, /assetRef\?: string \| null/);
  assert.match(texture, /if \(assetRef\)/);
  assert.match(texture, /loadImage\(assetRef\)/);
  assert.match(texture, /drawProceduralBase\(context, skin, resolution\)/);
  assert.match(texture, /drawPips\(context, value, resolution, pipColor\)/);
  assert.match(assets, /options\.assetRef \?\? "procedural"/);
  assert.doesNotMatch(launch, /assetRef|cosmetic|catalog|profile/);
  assert.doesNotMatch(predetermined, /assetRef|cosmetic|catalog|profile/);
});

test("CDN de dados possui fallback same-origin e não fixa fallback procedural no cache cosmético", () => {
  const texture = source("src/lib/client/dice/textures/create-face-texture.ts");
  const assets = source("src/lib/client/dice/dice-assets-manager.ts");

  assert.match(texture, /function diceAssetProxyFallback/);
  assert.match(texture, /\/api\/assets\/dice\?key=/);
  assert.match(texture, /loadDiceSourceImageCandidate\(src\)/);
  assert.match(texture, /loadDiceSourceImageCandidate\(fallback\)/);
  assert.match(texture, /texture\.userData\.diceSource = source/);

  assert.match(assets, /texture\.userData\.diceSource !== options\.assetRef/);
  assert.match(assets, /textureCache\.delete\(key\)/);
});

test("combate usa skin de ataque do atacante e defesa do defensor", () => {
  const overlay = source("src/components/battle-overlay.tsx");
  const cinematic = source(
    "src/components/dice-3d/battle-dice-cinematic.tsx",
  );
  const staticResults = source(
    "src/components/battle-static-dice-results.tsx",
  );
  const fullscreen = source(
    "src/components/dice-3d/fullscreen-dice-cinematic.tsx",
  );

  assert.match(
    overlay,
    /attacker\?\.cosmetics\.diceAttack\.assetRef \?\? null/,
  );
  assert.match(
    overlay,
    /defender\?\.cosmetics\.diceDefense\.assetRef \?\? null/,
  );
  assert.match(overlay, /assetRef=\{cinematicAssetRef\}/);
  assert.match(overlay, /attackAssetRef=\{attackAssetRef\}/);
  assert.match(overlay, /defenseAssetRef=\{defenseAssetRef\}/);
  assert.match(cinematic, /assetRef=\{assetRef\}/);
  assert.match(cinematic, /color=\{color\}/);
  assert.match(fullscreen, /useDiceFaceTextures/);
  assert.match(fullscreen, /pipColor: playerColorHex\(color\)/);
  assert.doesNotMatch(fullscreen, /DICE_VISUAL_PIP_COLOR/);
  assert.match(fullscreen, /DICE_VISUAL_TEXTURE_RESOLUTION/);
  assert.match(fullscreen, /bodyColor/);
  assert.match(staticResults, /skin=\{side\}/);
  assert.match(staticResults, /assetRef=\{attackAssetRef\}/);
  assert.match(staticResults, /assetRef=\{defenseAssetRef\}/);
});

test("ordem de jogo usa o dado neutro congelado do jogador", () => {
  const client = source("src/components/game-client-v2.tsx");
  const cinematic = source(
    "src/components/dice-3d/order-dice-cinematic.tsx",
  );
  const die = source("src/components/game-die.tsx");

  assert.match(
    client,
    /assetRef=\{lastOrderRollPlayer\.cosmetics\.diceNeutral\.assetRef\}/,
  );
  assert.match(
    client,
    /assetRef=\{shownPlayer\?\.cosmetics\.diceNeutral\.assetRef\}/,
  );
  assert.match(cinematic, /assetRef=\{assetRef\}/);
  assert.match(cinematic, /color=\{color\}/);
  assert.match(die, /requestedAsset = assetRef\?\.trim\(\) \|\| null/);
});

test("asset ausente ou inválido usa fallback procedural sem tocar no resultado", () => {
  const texture = source("src/lib/client/dice/textures/create-face-texture.ts");
  const die = source("src/components/game-die.tsx");
  const skins = source("src/lib/client/dice/textures/dice-skins.ts");

  assert.match(texture, /DICE_PROCEDURAL_PALETTES\[skin\]/);
  assert.match(
    texture,
    /catch \{[\s\S]*drawProceduralBase\(context, skin, resolution\)/,
  );
  assert.match(texture, /presentation-only/);
  assert.match(die, /DICE_PROCEDURAL_PALETTES\[skin\]/);
  assert.match(die, /failedAsset !== requestedAsset/);
  assert.match(die, /onError=\{\(\) => setFailedAsset\(imageSource\)\}/);
  assert.match(die, /data-dice-source=\{imageSource \? "cosmetic" : "procedural"\}/);
  assert.doesNotMatch(die, /useEffect/);
  assert.doesNotMatch(die, /dado-[^"']+\.svg/);
  assert.doesNotMatch(texture, /dado-[^"']+\.svg/);
  assert.doesNotMatch(skins, /\.svg/);
  assert.match(skins, /neutral:[\s\S]*attack:[\s\S]*defense:/);
});
