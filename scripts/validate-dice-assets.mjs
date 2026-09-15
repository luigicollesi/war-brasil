import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { loadEnvFile } from "node:process";
import { Client } from "pg";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) loadEnvFile(envFile);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "[assets] DATABASE_URL não está configurada para validar o catálogo cosmético.",
  );
  process.exit(1);
}

const require = createRequire(import.meta.url);
const {
  assetStorageConfigFromEnv,
  assertDiceAssetKey,
  assertTerritorySkinAssetKey,
} = require("../.test-build/server/assets/asset-storage-config.js");
const {
  validateDiceAssetObject,
  validateTerritorySkinAssetObject,
} = require("../.test-build/server/assets/asset-storage-s3.js");

const config = assetStorageConfigFromEnv(process.env);
const client = new Client({ connectionString });
const concurrency = 6;

async function loadCatalogAssets() {
  const result = await client.query(`
    SELECT id, slot, asset_ref
    FROM catalog.cosmetics
    WHERE slot IN ('dice_attack', 'dice_defense', 'dice_neutral', 'territory_effect')
      AND status IN ('announced', 'available', 'retired')
      AND asset_ref IS NOT NULL
    ORDER BY id
  `);

  if (result.rowCount === 0) {
    throw new Error("O catálogo não possui assets cosméticos publicáveis para validar.");
  }

  const seen = new Set();
  return result.rows.map((row) => {
    if (typeof row.asset_ref !== "string" || row.asset_ref.length === 0) {
      throw new Error(`O cosmético ${row.id} não possui asset_ref remoto.`);
    }

    const territorySkin = row.slot === "territory_effect";
    const objectKey = territorySkin
      ? assertTerritorySkinAssetKey(row.asset_ref)
      : assertDiceAssetKey(row.asset_ref);
    if (seen.has(objectKey)) {
      throw new Error(`Object key duplicada no catálogo: ${objectKey}.`);
    }
    seen.add(objectKey);

    return {
      cosmeticId: row.id,
      objectKey,
      kind: territorySkin ? "territory-skin" : "dice",
    };
  });
}

async function validateAssets(assets) {
  const validated = [];

  for (let offset = 0; offset < assets.length; offset += concurrency) {
    const batch = assets.slice(offset, offset + concurrency);
    const results = await Promise.all(
      batch.map(async (asset) => ({
        ...asset,
        metadata:
          asset.kind === "territory-skin"
            ? await validateTerritorySkinAssetObject(config, asset.objectKey)
            : await validateDiceAssetObject(config, asset.objectKey),
      })),
    );
    validated.push(...results);
  }

  for (const asset of validated) {
    if (asset.metadata.contentLength === 0) {
      throw new Error(`O asset ${asset.objectKey} existe, mas está vazio.`);
    }
  }

  return validated;
}

try {
  await client.connect();
  const assets = await loadCatalogAssets();
  const validated = await validateAssets(assets);

  const knownBytes = validated.reduce(
    (total, asset) => total + (asset.metadata.contentLength ?? 0),
    0,
  );
  const unknownSizes = validated.filter(
    (asset) => asset.metadata.contentLength === null,
  ).length;
  const territorySkinCount = validated.filter(
    (asset) => asset.kind === "territory-skin",
  ).length;

  console.log(
    `[assets] ${validated.length} WebPs do catálogo validados no bucket ${config.bucket} (${territorySkinCount} territory skins).`,
  );
  if (knownBytes > 0) {
    console.log(`[assets] ${knownBytes} bytes confirmados por Content-Length.`);
  }
  if (unknownSizes > 0) {
    console.log(
      `[assets] ${unknownSizes} objetos não informaram Content-Length, mas responderam HEAD image/webp com sucesso.`,
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Falha desconhecida na validação de assets.";
  console.error(`[assets] ${message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
