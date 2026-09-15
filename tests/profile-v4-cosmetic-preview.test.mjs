import assert from "node:assert/strict";
import test from "node:test";
import { cosmeticPreviewSource } from "../.test-build/economy/cosmetic-preview.js";

function item(overrides = {}) {
  return {
    id: "cosmetic-1",
    slug: "cosmetic.test",
    name: "Cosmético",
    description: null,
    slot: "territory_effect",
    rarity: null,
    status: "available",
    isDefault: false,
    owned: true,
    equipped: false,
    previewRef: null,
    assetRef: null,
    effectKey: null,
    ...overrides,
  };
}

test("PROFILE V4 usa previewRef entregável antes de assetRef", () => {
  assert.equal(
    cosmeticPreviewSource(
      item({
        previewRef: "/api/assets/preview?key=territory.webp",
        assetRef: "/api/assets/full?key=territory.webp",
      }),
    ),
    "/api/assets/preview?key=territory.webp",
  );
});

test("PROFILE V4 aceita assetRef já projetado para rota HTTP do cliente", () => {
  assert.equal(
    cosmeticPreviewSource(item({ assetRef: "/api/assets/dice?key=dice.webp" })),
    "/api/assets/dice?key=dice.webp",
  );
  assert.equal(
    cosmeticPreviewSource(item({ assetRef: "https://assets.example.test/cosmetic.webp" })),
    "https://assets.example.test/cosmetic.webp",
  );
});

test("PROFILE V4 não entrega object key R2 crua para next/image", () => {
  assert.equal(
    cosmeticPreviewSource(
      item({ assetRef: "cosmetics/territory-skins/azulejo_brasil.webp" }),
    ),
    null,
  );
});

test("PROFILE V4 degrada skin procedural sem preview para fallback visual", () => {
  assert.equal(cosmeticPreviewSource(item({ effectKey: "default" })), null);
});
