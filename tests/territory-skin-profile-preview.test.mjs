import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("preview territorial compõe texture sobre PlayerColor sem conhecer temas concretos", () => {
  const preview = source("src/components/economy/territory-skin-preview.tsx");

  assert.match(preview, /territoryMaterial\(playerColor\)/);
  assert.match(preview, /playerColor = "forest"/);
  assert.match(preview, /mixBlendMode:\s*"luminosity"/);
  assert.match(preview, /opacity:\s*0\.52/);
  assert.match(preview, /material\.face/);
  assert.match(preview, /material\.rim/);
  assert.match(preview, /onError=/);
  assert.match(preview, /failedAssetRef/);
  assert.doesNotMatch(preview, /azulejo|solar|estrelado|viking|gato|futebol/i);
  assert.doesNotMatch(preview, /fetch\(/);
});

test("preview territorial é primitive de apresentação e não altera economia ou gameplay", () => {
  const preview = source("src/components/economy/territory-skin-preview.tsx");

  assert.doesNotMatch(preview, /wallet|ledger|purchase|inventory|cosmetic_loadout/i);
  assert.doesNotMatch(preview, /gameCommand|hitbox|pointermove|attack|maneuver/i);
  assert.match(preview, /pointerEvents:\s*"none"/);
  assert.match(preview, /aria-hidden="true"/);
});
