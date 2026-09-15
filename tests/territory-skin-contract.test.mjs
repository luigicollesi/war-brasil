import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_TERRITORY_SKIN,
  assertTerritorySkinAssetKey,
  isTerritorySkinAssetKey,
  territorySkinAssetRefFromRuntimeEffectKey,
  territorySkinRuntimeEffectKey,
  territorySkinSnapshot,
} from "../.test-build/economy/territory-skin-contract.js";

const IMAGE_KEY = "cosmetics/territory-skins/azulejo_brasil.webp";

test("territory skin distingue snapshot procedural e image sem URL temporária", () => {
  assert.deepEqual(
    territorySkinSnapshot({
      cosmeticId: "territory.effect.default",
      assetRef: null,
      effectKey: "default",
    }),
    {
      kind: "procedural",
      cosmeticId: "territory.effect.default",
      effectKey: "default",
    },
  );

  assert.deepEqual(
    territorySkinSnapshot({
      cosmeticId: "territory.effect.azulejo-brasil",
      assetRef: IMAGE_KEY,
      effectKey: null,
    }),
    {
      kind: "image",
      cosmeticId: "territory.effect.azulejo-brasil",
      assetRef: IMAGE_KEY,
    },
  );
});

test("descriptor legado ou ambíguo degrada apenas em memória para default", () => {
  for (const descriptor of [
    null,
    undefined,
    { cosmeticId: "legacy", assetRef: null, effectKey: null },
    { cosmeticId: "ambiguous", assetRef: IMAGE_KEY, effectKey: "default" },
    {
      cosmeticId: "invalid-image",
      assetRef: "https://example.invalid/signed.webp?token=temporary",
      effectKey: null,
    },
  ]) {
    assert.deepEqual(territorySkinSnapshot(descriptor), DEFAULT_TERRITORY_SKIN);
  }
});

test("image territory skin aceita somente object key WebP canônica", () => {
  for (const key of [
    IMAGE_KEY,
    "cosmetics/territory-skins/azulejo_ornamental.webp",
    "cosmetics/territory-skins/ceu-estrelado.webp",
    "cosmetics/territory-skins/solar_ornamental.webp",
  ]) {
    assert.equal(isTerritorySkinAssetKey(key), true);
    assert.equal(assertTerritorySkinAssetKey(key), key);
  }

  for (const key of [
    "cosmetics/territory-skins/azulejo.svg",
    "cosmetics/territory-skins/Azulejo.webp",
    "cosmetics/dice/default/attack.webp",
    "territory-skins/azulejo.webp",
    "https://cdn.example/azulejo.webp",
  ]) {
    assert.equal(isTerritorySkinAssetKey(key), false);
    assert.throws(() => assertTerritorySkinAssetKey(key));
  }
});

test("bridge transitório round-tripa somente delivery path interno válido", () => {
  const snapshot = territorySkinSnapshot({
    cosmeticId: "territory.effect.azulejo-brasil",
    assetRef: IMAGE_KEY,
    effectKey: null,
  });
  const runtimeKey = territorySkinRuntimeEffectKey(
    snapshot,
    (assetRef) => `/api/assets/territory-skins?key=${encodeURIComponent(assetRef)}`,
  );

  assert.equal(
    territorySkinAssetRefFromRuntimeEffectKey(runtimeKey),
    `/api/assets/territory-skins?key=${encodeURIComponent(IMAGE_KEY)}`,
  );
  assert.equal(
    territorySkinAssetRefFromRuntimeEffectKey(
      `territory-image:${encodeURIComponent("https://evil.invalid/skin.webp")}`,
    ),
    null,
  );
  assert.equal(territorySkinAssetRefFromRuntimeEffectKey("future-procedural"), null);
});

test("contrato persistente mantém exclusividade procedural/image apenas em territory_effect", () => {
  const migration = readFileSync(
    "src/lib/db/migrations/managed/042-territory-skins-v1.sql",
    "utf8",
  );

  assert.match(migration, /slot <> 'territory_effect'/);
  assert.match(
    migration,
    /effect_key IS NOT NULL\s+AND asset_ref IS NULL[\s\S]*effect_key IS NULL\s+AND asset_ref IS NOT NULL/,
  );
  assert.match(
    migration,
    /\^cosmetics\/territory-skins\/[a-z0-9]/,
  );

  for (const key of [
    "cosmetics/territory-skins/azulejo_brasil.webp",
    "cosmetics/territory-skins/azulejo_ornamental.webp",
    "cosmetics/territory-skins/ceu_estrelado.webp",
    "cosmetics/territory-skins/solar_ornamental.webp",
  ]) {
    assert.match(migration, new RegExp(key.replaceAll(".", "\\.")));
  }
});

test("snapshot da partida permanece a autoridade e não consulta perfil em runtime", () => {
  const service = readFileSync(
    "src/lib/server/game-cosmetic-loadout-service.ts",
    "utf8",
  );

  assert.match(service, /territorySkinSnapshot/);
  assert.match(service, /snapshot\.asset_ref/);
  assert.match(service, /snapshot\.effect_key/);

  const runtimeSection = service.slice(service.indexOf("export async function loadRoomPlayerCosmetics"));
  assert.doesNotMatch(runtimeSection, /profile\.|inventory\.|catalog\./);
});
