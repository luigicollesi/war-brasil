import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("renderer de image skin usa overlay SVG compartilhado sem tocar hitbox", () => {
  const overlay = source("src/lib/client/map/territory-skin-overlay.ts");
  const material = source("src/lib/client/map/territory-material.ts");
  const svgNodes = source("src/lib/client/map/territory-svg-nodes.ts");
  const board = source("src/components/interactive-board.tsx");
  const hitGeometry = source("src/lib/client/map/territory-hit-geometry.ts");

  assert.match(overlay, /createElementNS\(SVG_NS, "pattern"\)/);
  assert.match(overlay, /createElementNS\(SVG_NS, "image"\)/);
  assert.match(overlay, /pointer-events/);
  assert.match(overlay, /territory-skin-overlay/);
  assert.match(overlay, /ensureTerritorySkinPattern/);
  assert.match(overlay, /Map<string, string>/);

  assert.match(material, /territorySkinAssetRefFromRuntimeEffectKey/);
  assert.match(material, /skinAssetRef: string \| null/);
  assert.match(svgNodes, /applyTerritorySkinOverlay/);
  assert.match(svgNodes, /material\.skinAssetRef/);

  assert.doesNotMatch(board, /fetch\(/);
  assert.doesNotMatch(hitGeometry, /territorySkin|skinAsset|cosmetic/i);
});

test("falha de WebP remove todos os overlays daquele asset e revela material base", () => {
  const overlay = source("src/lib/client/map/territory-skin-overlay.ts");

  assert.match(overlay, /function removeTerritorySkinOverlaysForAsset/);
  assert.match(
    overlay,
    /querySelectorAll<SVGPathElement>\("path\.territory-skin-overlay"\)/,
  );
  assert.match(
    overlay,
    /overlay\.dataset\.territorySkinAsset === assetRef/,
  );
  assert.match(overlay, /removeTerritorySkinOverlaysForAsset\(document, assetRef\)/);
  assert.match(overlay, /registry\.delete\(assetRef\)/);
  assert.match(overlay, /pattern\.remove\(\)/);
});

test("runtime mantém DTO legado, mas projeta image skin por chave transitória não persistida", () => {
  const service = source("src/lib/server/game-cosmetic-loadout-service.ts");
  const contract = source("src/lib/economy/territory-skin-contract.ts");
  const client = source("src/components/game-client-v2.tsx");

  assert.match(service, /territorySkinRuntimeEffectKey/);
  assert.match(contract, /TERRITORY_SKIN_RUNTIME_IMAGE_PREFIX/);
  assert.match(contract, /territorySkinAssetRefFromRuntimeEffectKey/);
  assert.match(
    client,
    /territoryEffectKey: owner\.cosmetics\.territoryEffect\.effectKey/,
  );
});

test("conquista troca skin pela do novo dono congelado no snapshot", () => {
  const client = source("src/components/game-client-v2.tsx");

  assert.match(
    client,
    /const owner = game\.playersById\.get\(territory\.ownerPlayerId\)/,
  );
  assert.match(
    client,
    /territoryEffectKey: owner\.cosmetics\.territoryEffect\.effectKey/,
  );
});

test("assinatura existente reaplica material/skin sem criar estado React por território", () => {
  const board = source("src/components/interactive-board.tsx");

  assert.match(board, /materialSignatureRef = useRef\(new Map<number, string>\(\)\)/);
  assert.match(board, /:effect:\$\{territoryEffectKey\}/);
  assert.doesNotMatch(board, /useState<.*territorySkin|setTerritorySkin/i);
});
