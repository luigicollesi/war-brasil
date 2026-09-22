import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_TERRITORY_EFFECT_KEY,
  normalizeTerritoryEffectKey,
  territoryMaterial,
} from "../.test-build/client/map/territory-material.js";

function source(path) {
  return readFileSync(path, "utf8");
}

const COLORS = ["forest", "ocean", "sun", "ruby", "violet", "orange"];

test("efeito territorial default preserva as seis identidades PlayerColor", () => {
  assert.equal(DEFAULT_TERRITORY_EFFECT_KEY, "default");
  assert.equal(normalizeTerritoryEffectKey(null), "default");
  assert.equal(normalizeTerritoryEffectKey(undefined), "default");
  assert.equal(normalizeTerritoryEffectKey("   "), "default");

  for (const color of COLORS) {
    const nativeMaterial = territoryMaterial(color);
    const defaultMaterial = territoryMaterial(color, "default");
    const unknownMaterial = territoryMaterial(color, "future-not-installed");

    assert.equal(defaultMaterial.playerColor, color);
    assert.equal(unknownMaterial.playerColor, color);
    assert.deepEqual(defaultMaterial, nativeMaterial);
    assert.deepEqual(unknownMaterial, nativeMaterial);
  }
});

test("image skin preserva face, profundidade e rim de todos os seis PlayerColors", () => {
  const assetKey = "cosmetics/territory-skins/azulejo_brasil.webp";
  const runtimeKey = `territory-image:${encodeURIComponent(assetKey)}`;
  const expectedDeliveryPath =
    `/api/assets/territory-skins?key=${encodeURIComponent(assetKey)}`;

  for (const color of COLORS) {
    const nativeMaterial = territoryMaterial(color);
    const skinnedMaterial = territoryMaterial(color, runtimeKey);

    assert.equal(skinnedMaterial.playerColor, color);
    assert.deepEqual(skinnedMaterial.face, nativeMaterial.face, color);
    assert.deepEqual(skinnedMaterial.side, nativeMaterial.side, color);
    assert.equal(skinnedMaterial.rim, nativeMaterial.rim, color);
    assert.equal(skinnedMaterial.skinAssetRef, expectedDeliveryPath, color);
  }
});

test("tabuleiro deriva efeito do dono sem criar fetch, estado ou hitbox cosmético", () => {
  const client = source("src/components/game-client-v2.tsx");
  const board = source("src/components/interactive-board.tsx");
  const material = source("src/lib/client/map/territory-material.ts");
  const hitGeometry = source("src/lib/client/map/territory-hit-geometry.ts");

  assert.match(
    client,
    /territoryEffectKey: owner\.cosmetics\.territoryEffect\.effectKey/,
  );
  assert.match(board, /territoryEffectKey: string \| null/);
  assert.match(board, /territoryAssetRef: string \| null/);
  assert.match(
    client,
    /territoryAssetRef: owner\.cosmetics\.territoryEffect\.assetRef/,
  );
  assert.match(board, /normalizeTerritoryEffectKey/);
  assert.match(board, /:effect:\$\{territoryEffectKey\}:asset:/);
  assert.match(
    board,
    /territoryMaterial\(territory\.ownerColor, territoryEffectKey\)/,
  );

  // Marcadores de tropas permanecem ancorados apenas à PlayerColor. O efeito
  // altera a superfície territorial, nunca a legibilidade dos contadores.
  assert.ok(
    (board.match(/territoryMaterial\(territory\.ownerColor\)/g) ?? []).length >= 2,
  );

  assert.match(material, /TERRITORY_EFFECT_RESOLVERS/);
  assert.match(material, /\[DEFAULT_TERRITORY_EFFECT_KEY\]: \(base\) => base/);
  assert.doesNotMatch(material, /filter:|blur\(|animation|requestAnimationFrame/i);
  assert.doesNotMatch(board, /fetch\(|profile\.|inventory\./);
  assert.doesNotMatch(hitGeometry, /territoryEffect|effectKey|cosmetic/i);
});

test("mudança de efeito reaplica material por assinatura sem remontar estado territorial", () => {
  const board = source("src/components/interactive-board.tsx");

  assert.match(board, /materialSignatureRef = useRef\(new Map<number, string>\(\)\)/);
  assert.match(board, /materialSignatureRef\.current\.get\(id\) !== materialKey/);
  assert.match(board, /materialSignatureRef\.current\.set\(id, materialKey\)/);
  assert.doesNotMatch(board, /useState<.*territoryEffect|setTerritoryEffect/i);
});
