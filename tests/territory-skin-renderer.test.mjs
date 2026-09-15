import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("renderer de image skin usa overlay SVG compartilhado sem tocar hitbox", () => {
  const overlay = source("src/lib/client/map/territory-skin-overlay.ts");
  const board = source("src/components/interactive-board.tsx");
  const hitGeometry = source("src/lib/client/map/territory-hit-geometry.ts");

  assert.match(overlay, /createElementNS\(SVG_NS, "pattern"\)/);
  assert.match(overlay, /createElementNS\(SVG_NS, "image"\)/);
  assert.match(overlay, /pointer-events/);
  assert.match(overlay, /territory-skin-overlay/);
  assert.match(overlay, /ensureTerritorySkinPattern/);
  assert.match(overlay, /Map<string, string>/);

  assert.match(board, /territoryCosmeticId: string/);
  assert.match(board, /territorySkinAssetRef: string \| null/);
  assert.match(board, /applyTerritorySkinOverlay/);
  assert.match(board, /skinSignatureRef/);
  assert.doesNotMatch(board, /fetch\(/);
  assert.doesNotMatch(hitGeometry, /territorySkin|skinAsset|cosmetic/i);
});

test("game client deriva skin do snapshot congelado do dono", () => {
  const client = source("src/components/game-client-v2.tsx");

  assert.match(
    client,
    /territoryCosmeticId: owner\.cosmetics\.territoryEffect\.cosmeticId/,
  );
  assert.match(
    client,
    /territorySkinAssetRef: owner\.cosmetics\.territoryEffect\.assetRef/,
  );
  assert.match(
    client,
    /territoryEffectKey: owner\.cosmetics\.territoryEffect\.effectKey/,
  );
});

test("assinatura da skin usa identidade lógica e não cria estado React por território", () => {
  const board = source("src/components/interactive-board.tsx");

  assert.match(board, /skinSignatureRef = useRef\(new Map<number, string>\(\)\)/);
  assert.match(board, /territory\.territoryCosmeticId/);
  assert.match(board, /territory\.territorySkinAssetRef/);
  assert.doesNotMatch(board, /useState<.*territorySkin|setTerritorySkin/i);
});
