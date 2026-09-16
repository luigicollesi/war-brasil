import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AssetStorageConfigError,
  assertTerritorySkinAssetKey,
  isTerritorySkinAssetKey,
  parseAssetStorageUrl,
} from "../.test-build/server/assets/asset-storage-config.js";
import {
  AssetStorageRequestError,
  validateTerritorySkinAssetObject,
} from "../.test-build/server/assets/asset-storage-s3.js";

function source(path) {
  return readFileSync(path, "utf8");
}

const config = parseAssetStorageUrl(
  "s3://ACCESS:secret@abc123.r2.cloudflarestorage.com/war-brasil-assets-prod?region=auto",
);

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

test("validação R2 de territory skin exige HEAD image/webp", async () => {
  const key = "cosmetics/territory-skins/azulejo_brasil.webp";
  const calls = [];
  const metadata = await validateTerritorySkinAssetObject(
    config,
    key,
    async (url, init) => {
      calls.push({ url: String(url), method: init?.method });
      return new Response(null, {
        status: 200,
        headers: {
          "content-type": "image/webp; charset=binary",
          "content-length": "4096",
          etag: '"skin-etag"',
        },
      });
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "HEAD");
  assert.equal(
    new URL(calls[0].url).pathname,
    "/war-brasil-assets-prod/cosmetics/territory-skins/azulejo_brasil.webp",
  );
  assert.deepEqual(metadata, {
    objectKey: key,
    contentType: "image/webp",
    contentLength: 4096,
    etag: '"skin-etag"',
  });

  await assert.rejects(
    validateTerritorySkinAssetObject(
      config,
      key,
      async () =>
        new Response(null, {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    ),
    (error) =>
      error instanceof AssetStorageRequestError &&
      error.code === "TERRITORY_SKIN_ASSET_CONTENT_TYPE_INVALID",
  );
});

test("assets:validate inclui territory skins do catálogo sem allowlist temática", () => {
  const validator = source("scripts/validate-dice-assets.mjs");

  assert.match(validator, /slot IN \('dice_attack', 'dice_defense', 'dice_neutral', 'territory_skin'\)/);
  assert.match(validator, /validateTerritorySkinAssetObject/);
  assert.match(validator, /assertTerritorySkinAssetKey/);
  assert.doesNotMatch(validator, /azulejo_brasil|azulejo_ornamental|ceu_estrelado|solar_ornamental/);
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

  assert.match(repository, /item\.slot='territory_skin'/);
  assert.match(repository, /snapshot\.slot='territory_skin'/);
  assert.match(repository, /snapshot\.asset_ref=\$1/);
  assert.doesNotMatch(repository, /ListObjects|listObjects/i);

  assert.match(
    service,
    /\/api\/assets\/territory-skins\?key=\$\{encodeURIComponent\(key\)\}/,
  );
  assert.match(service, /createPresignedAssetUrl/);
});

test("economy storefront projeta territory_skin pela rota interna de delivery", () => {
  const economyService = source("src/lib/server/economy/economy-service.ts");

  assert.match(economyService, /territorySkinAssetDeliveryPath/);
  assert.match(
    economyService,
    /if \(row\.slot === "territory_skin"\) \{\s*return territorySkinAssetDeliveryPath\(row\.asset_ref\);\s*\}/,
  );
  assert.doesNotMatch(economyService, /https?:\/\/[^"']*territory-skins/);
});
