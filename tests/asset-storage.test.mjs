import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASSET_STORAGE_BUCKET,
  ASSET_STORAGE_REGION,
  AssetStorageConfigError,
  assertDiceAssetKey,
  assetStorageConfigFromEnv,
  diceAssetKey,
  diceCollectionAssetKeys,
  isDiceAssetKey,
  parseAssetStorageUrl,
} from "../.test-build/server/assets/asset-storage-config.js";
import {
  AssetStorageRequestError,
  createPresignedAssetUrl,
  createPresignedDiceAssetUrl,
  validateDiceAssetObject,
  validateDiceCollection,
} from "../.test-build/server/assets/asset-storage-s3.js";

const connection =
  "s3://ACCESS%2FKEY:secret%3Awith%40reserved@abc123.r2.cloudflarestorage.com/war-brasil-assets-prod?region=auto";

const config = parseAssetStorageUrl(connection);

test("ASSET_STORAGE_URL deriva configuração R2 sem manter credenciais no endpoint", () => {
  assert.equal(config.accessKeyId, "ACCESS/KEY");
  assert.equal(config.secretAccessKey, "secret:with@reserved");
  assert.equal(config.host, "abc123.r2.cloudflarestorage.com");
  assert.equal(config.endpoint, "https://abc123.r2.cloudflarestorage.com");
  assert.equal(config.bucket, ASSET_STORAGE_BUCKET);
  assert.equal(config.region, ASSET_STORAGE_REGION);
  assert.doesNotMatch(config.endpoint, /ACCESS|secret/i);
});

test("configuração exige apenas ASSET_STORAGE_URL e bucket de produção esperado", () => {
  assert.deepEqual(assetStorageConfigFromEnv({ ASSET_STORAGE_URL: connection }), config);

  assert.throws(
    () =>
      assetStorageConfigFromEnv({
        ASSET_STORAGE_URL:
          "s3://key:secret@abc123.r2.cloudflarestorage.com/outro-bucket?region=auto",
      }),
    (error) =>
      error instanceof AssetStorageConfigError &&
      error.code === "ASSET_STORAGE_URL_UNEXPECTED_BUCKET" &&
      !error.message.includes("secret"),
  );
});

test("parser rejeita protocolo, endpoint, query e região incompatíveis sem ecoar segredo", () => {
  for (const [value, code] of [
    ["https://key:very-secret@abc123.r2.cloudflarestorage.com/war-brasil-assets-prod?region=auto", "ASSET_STORAGE_URL_INVALID_PROTOCOL"],
    ["s3://key:very-secret@example.com/war-brasil-assets-prod?region=auto", "ASSET_STORAGE_URL_INVALID_ENDPOINT"],
    ["s3://key:very-secret@abc123.r2.cloudflarestorage.com/war-brasil-assets-prod?region=us-east-1", "ASSET_STORAGE_URL_INVALID_REGION"],
    ["s3://key:very-secret@abc123.r2.cloudflarestorage.com/war-brasil-assets-prod?region=auto&token=x", "ASSET_STORAGE_URL_INVALID_QUERY"],
  ]) {
    assert.throws(
      () => parseAssetStorageUrl(value),
      (error) =>
        error instanceof AssetStorageConfigError &&
        error.code === code &&
        !error.message.includes("very-secret"),
    );
  }
});

test("dados remotos aceitam somente object keys WebP canônicas", () => {
  assert.equal(
    diceAssetKey("military-classic", "attack"),
    "cosmetics/dice/military-classic/attack.webp",
  );
  assert.deepEqual(diceCollectionAssetKeys("cat"), [
    "cosmetics/dice/cat/attack.webp",
    "cosmetics/dice/cat/defense.webp",
    "cosmetics/dice/cat/neutral.webp",
  ]);

  for (const key of [
    "cosmetics/dice/default/attack.webp",
    "cosmetics/dice/medieval-spears/defense.webp",
    "cosmetics/dice/football/neutral.webp",
  ]) {
    assert.equal(isDiceAssetKey(key), true);
    assert.equal(assertDiceAssetKey(key), key);
  }

  for (const key of [
    "cosmetics/dice/viking/attack.svg",
    "cosmetics/dice/viking/attack.png",
    "cosmetics/dice/viking/preview.webp",
    "cosmetics/dice/Viking/attack.webp",
    "other/dice/viking/attack.webp",
  ]) {
    assert.equal(isDiceAssetKey(key), false);
    assert.throws(() => assertDiceAssetKey(key), AssetStorageConfigError);
  }
});

test("presign SigV4 produz URL HTTPS finita sem Secret Access Key", () => {
  const signed = createPresignedDiceAssetUrl(
    config,
    "cosmetics/dice/viking/attack.webp",
    { now: new Date("2026-09-14T21:00:00.000Z"), expiresInSeconds: 300 },
  );
  const url = new URL(signed);

  assert.equal(url.protocol, "https:");
  assert.equal(url.host, config.host);
  assert.equal(url.pathname, "/war-brasil-assets-prod/cosmetics/dice/viking/attack.webp");
  assert.equal(url.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.equal(url.searchParams.get("X-Amz-Date"), "20260914T210000Z");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "host");
  assert.match(
    url.searchParams.get("X-Amz-Credential") ?? "",
    /^ACCESS\/KEY\/20260914\/auto\/s3\/aws4_request$/,
  );
  assert.match(url.searchParams.get("X-Amz-Signature") ?? "", /^[a-f0-9]{64}$/);
  assert.doesNotMatch(signed, /secret:with|secret%3Awith/i);
});

test("assinatura muda por método e rejeita expiração fora da política", () => {
  const now = new Date("2026-09-14T21:00:00.000Z");
  const key = "cosmetics/dice/dog/defense.webp";
  const getUrl = createPresignedAssetUrl(config, key, { method: "GET", now });
  const headUrl = createPresignedAssetUrl(config, key, { method: "HEAD", now });

  assert.notEqual(
    new URL(getUrl).searchParams.get("X-Amz-Signature"),
    new URL(headUrl).searchParams.get("X-Amz-Signature"),
  );
  assert.throws(
    () => createPresignedAssetUrl(config, key, { expiresInSeconds: 0 }),
    (error) =>
      error instanceof AssetStorageRequestError &&
      error.code === "ASSET_STORAGE_EXPIRY_INVALID",
  );
  assert.throws(
    () => createPresignedAssetUrl(config, key, { expiresInSeconds: 901 }),
    AssetStorageRequestError,
  );
});

test("HeadObject lógico exige sucesso e Content-Type image/webp", async () => {
  const calls = [];
  const metadata = await validateDiceAssetObject(
    config,
    "cosmetics/dice/cat/neutral.webp",
    async (url, init) => {
      calls.push({ url: String(url), method: init?.method });
      return new Response(null, {
        status: 200,
        headers: {
          "content-type": "image/webp",
          "content-length": "2048",
          etag: '"abc123"',
        },
      });
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "HEAD");
  assert.equal(new URL(calls[0].url).pathname, "/war-brasil-assets-prod/cosmetics/dice/cat/neutral.webp");
  assert.deepEqual(metadata, {
    objectKey: "cosmetics/dice/cat/neutral.webp",
    contentType: "image/webp",
    contentLength: 2048,
    etag: '"abc123"',
  });

  await assert.rejects(
    validateDiceAssetObject(
      config,
      "cosmetics/dice/cat/attack.webp",
      async () => new Response(null, { status: 200, headers: { "content-type": "image/svg+xml" } }),
    ),
    (error) =>
      error instanceof AssetStorageRequestError &&
      error.code === "DICE_ASSET_CONTENT_TYPE_INVALID",
  );
});

test("validação de coleção verifica exatamente ataque, defesa e neutro", async () => {
  const requested = [];
  const result = await validateDiceCollection(config, "football", async (url) => {
    requested.push(new URL(String(url)).pathname);
    return new Response(null, { status: 200, headers: { "content-type": "image/webp" } });
  });

  assert.deepEqual(result.keys, [
    "cosmetics/dice/football/attack.webp",
    "cosmetics/dice/football/defense.webp",
    "cosmetics/dice/football/neutral.webp",
  ]);
  assert.deepEqual(requested.sort(), [
    "/war-brasil-assets-prod/cosmetics/dice/football/attack.webp",
    "/war-brasil-assets-prod/cosmetics/dice/football/defense.webp",
    "/war-brasil-assets-prod/cosmetics/dice/football/neutral.webp",
  ]);
});

test("assets:validate deriva a lista do catálogo em vez de hardcode de temas", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const validator = readFileSync("scripts/validate-dice-assets.mjs", "utf8");

  assert.match(packageJson.scripts["assets:validate"], /test:compile/);
  assert.match(packageJson.scripts["assets:validate"], /validate-dice-assets\.mjs/);
  assert.match(validator, /FROM catalog\.cosmetics/);
  assert.match(validator, /validateDiceAssetObject/);
  assert.match(validator, /status IN \('announced', 'available', 'retired'\)/);
  assert.doesNotMatch(
    validator,
    /military-classic|medieval-spears|viking|cat|dog|football/,
  );
});
