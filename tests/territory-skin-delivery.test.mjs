import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AssetStorageConfigError,
  assertTerritorySkinAssetKey,
  isTerritorySkinAssetKey,
} from "../.test-build/server/assets/asset-storage-config.js";

function source(path) {
  return readFileSync(path, "utf8");
}

test("storage aceita somente territory skin WebP no namespace canônico", () => {
  for (const key of [
    "cosmetics/territory-skins/azulejo_brasil.webp",
    "cosmetics/territory-skins/azulejo-ornamental.webp",
    "cosmetics/territory-skins/ceu_estrelado.webp",
  ]) {
    assert.equal(isTerritorySkinAssetKey(key), true);
    assert.equal(assertTerritorySkinAssetKey(key), key);
  }

  for (const key of [
    "cosmetics/territory-skins/skin.png",
    "cosmetics/territory-skins/../skin.webp",
    "cosmetics/territory-skins/Skin.webp",
    "cosmetics/dice/default/attack.webp",
    "https://cdn.example/skin.webp",
  ]) {
    assert.equal(isTerritorySkinAssetKey(key), false);
    assert.throws(
      () => assertTerritorySkinAssetKey(key),
      (error) =>
        error instanceof AssetStorageConfigError &&
        error.code === "TERRITORY_SKIN_ASSET_KEY_INVALID",
    );
  }
});

test("delivery usa endpoint autenticado e catálogo/snapshot como allowlist", () => {
  const route = source("src/app/api/assets/territory-skins/route.ts");
  const repository = source("src/lib/server/assets/asset-storage-repository.ts");
  const service = source("src/lib/server/assets/asset-storage-service.ts");

  assert.match(route, /getAuthenticatedSession/);
  assert.match(route, /assertTerritorySkinAssetKey/);
  assert.match(route, /isKnownTerritorySkinAssetKey/);
  assert.match(route, /resolveTerritorySkinAssetReadUrl/);
  assert.match(route, /status: 307/);
  assert.match(route, /private, no-store/);

  assert.match(repository, /item\.slot='territory_effect'/);
  assert.match(repository, /snapshot\.slot='territory_effect'/);
  assert.match(repository, /snapshot\.asset_ref=\$1/);
  assert.doesNotMatch(repository, /ListObjects|listObjects/i);

  assert.match(
    service,
    /\/api\/assets\/territory-skins\?key=\$\{encodeURIComponent\(key\)\}/,
  );
  assert.match(service, /createPresignedAssetUrl/);
});

test("economy storefront projeta object key territorial para rota entregável pelo cliente", () => {
  const economyService = source("src/lib/server/economy/economy-service.ts");

  assert.match(economyService, /territorySkinAssetDeliveryPath/);
  assert.match(
    economyService,
    /row\.slot === "territory_effect"[\s\S]*territorySkinAssetDeliveryPath\(row\.asset_ref\)/,
  );
  assert.doesNotMatch(
    economyService,
    /row\.slot === "territory_effect"[\s\S]*return row\.asset_ref/,
  );
});
