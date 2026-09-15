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
    "[store-assets] DATABASE_URL não está configurada para validar os assets editoriais.",
  );
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { assetStorageConfigFromEnv } = require(
  "../.test-build/server/assets/asset-storage-config.js",
);
const {
  assertCollectionAssetKey,
  validateCollectionAssetObject,
} = require("../.test-build/server/assets/collection-asset-storage.js");

const config = assetStorageConfigFromEnv(process.env);
const client = new Client({ connectionString });
const requiredRoles = new Set(["banner", "background", "logo"]);
const concurrency = 6;

async function loadCollectionAssets() {
  const result = await client.query(`
    SELECT collection.id AS collection_id,
           collection.slug AS collection_slug,
           asset.role,
           asset.object_key
      FROM catalog.collection_assets asset
      JOIN catalog.collections collection ON collection.id=asset.collection_id
     WHERE asset.active=TRUE
       AND collection.active=TRUE
     ORDER BY collection.sort_order, collection.id, asset.role
  `);

  const byCollection = new Map();
  for (const row of result.rows) {
    const roles = byCollection.get(row.collection_id) ?? new Map();
    if (!requiredRoles.has(row.role)) {
      throw new Error(
        `A coleção ${row.collection_id} possui papel editorial V1 inválido: ${row.role}.`,
      );
    }
    if (roles.has(row.role)) {
      throw new Error(
        `A coleção ${row.collection_id} possui mais de um mapping ativo para ${row.role}.`,
      );
    }
    roles.set(row.role, {
      collectionId: row.collection_id,
      collectionSlug: row.collection_slug,
      role: row.role,
      objectKey: assertCollectionAssetKey(row.object_key),
    });
    byCollection.set(row.collection_id, roles);
  }

  const assets = [];
  for (const [collectionId, roles] of byCollection) {
    for (const role of requiredRoles) {
      if (!roles.has(role)) {
        throw new Error(
          `A coleção ${collectionId} não possui mapping ativo para ${role}.`,
        );
      }
    }
    assets.push(...roles.values());
  }
  return assets;
}

async function validateAssets(assets) {
  const validated = [];
  for (let offset = 0; offset < assets.length; offset += concurrency) {
    const batch = assets.slice(offset, offset + concurrency);
    const results = await Promise.all(
      batch.map(async (asset) => ({
        ...asset,
        metadata: await validateCollectionAssetObject(config, asset.objectKey),
      })),
    );
    validated.push(...results);
  }

  for (const asset of validated) {
    if (asset.metadata.contentLength === 0) {
      throw new Error(`O asset editorial ${asset.objectKey} existe, mas está vazio.`);
    }
  }
  return validated;
}

try {
  await client.connect();
  const assets = await loadCollectionAssets();
  const validated = await validateAssets(assets);
  const collections = new Set(validated.map((asset) => asset.collectionId));

  console.log(
    `[store-assets] ${validated.length} WebPs editoriais de ${collections.size} coleções validados por chave exata no bucket ${config.bucket}.`,
  );
} catch (error) {
  const message =
    error instanceof Error
      ? error.message
      : "Falha desconhecida na validação dos assets editoriais.";
  console.error(`[store-assets] ${message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
