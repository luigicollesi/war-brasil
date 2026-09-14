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
  assert.match(texture, /assetRef \?\? DICE_SKIN_SOURCES\[skin\]/);
  assert.match(texture, /drawPips\(context, value, resolution, pipColor\)/);
  assert.match(assets, /options\.assetRef \?\? "native"/);
  assert.doesNotMatch(launch, /assetRef|cosmetic|catalog|profile/);
  assert.doesNotMatch(predetermined, /assetRef|cosmetic|catalog|profile/);
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
  assert.match(fullscreen, /useDiceFaceTextures\(\{ skin, pipColor, assetRef \}\)/);
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
  assert.match(die, /src=\{assetRef \?\? "\/dado-brasil-hq\.svg"\}/);
});

test("asset nulo mantém explicitamente o renderer nativo", () => {
  const texture = source("src/lib/client/dice/textures/create-face-texture.ts");
  const die = source("src/components/game-die.tsx");
  const skins = source("src/lib/client/dice/textures/dice-skins.ts");

  assert.match(texture, /assetRef \?\? DICE_SKIN_SOURCES\[skin\]/);
  assert.match(die, /assetRef \?\? "\/dado-brasil-hq\.svg"/);
  assert.match(skins, /neutral: "\/dado-brasil-hq\.svg"/);
  assert.match(skins, /attack: "\/dado-ataque-vermelho-hq\.svg"/);
  assert.match(skins, /defense: "\/dado-defesa-azul-hq\.svg"/);
});
