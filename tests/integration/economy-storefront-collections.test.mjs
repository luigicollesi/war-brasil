import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

function urlForDatabase(name) {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function withTemporaryDatabase(callback) {
  const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const name = `war_store_collections_${suffix}`;
  const admin = new Client({ connectionString: databaseUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    await callback(urlForDatabase(name));
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
}

async function prepareDatabase(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(readFileSync("src/lib/db/schema.sql", "utf8"));
  } finally {
    await client.end();
  }

  const result = spawnSync(process.execPath, ["scripts/prepare-dev-db.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: connectionString },
  });
  assert.equal(
    result.status,
    0,
    `prepare-dev-db falhou:\n${result.stdout}\n${result.stderr}`,
  );
}

if (!databaseUrl) {
  test("storefront collection integration exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("Football é coleção dice-only com três mappings editoriais V1 exatos", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const db = new Client({ connectionString });
      await db.connect();
      try {
        const collection = await db.query(
          `SELECT id,slug,name,active
             FROM catalog.collections
            WHERE id='collection.football'`,
        );
        assert.equal(collection.rowCount, 1);
        assert.equal(collection.rows[0].slug, "football");
        assert.equal(collection.rows[0].active, true);

        const items = await db.query(
          `SELECT id,slot,asset_ref
             FROM catalog.cosmetics
            WHERE collection_id='collection.football'
            ORDER BY slot,id`,
        );
        assert.equal(items.rowCount, 3);
        assert.deepEqual(
          new Set(items.rows.map((row) => row.slot)),
          new Set(["dice_attack", "dice_defense", "dice_neutral"]),
        );
        assert.equal(items.rows.some((row) => row.slot === "territory_skin"), false);
        assert.deepEqual(
          new Set(items.rows.map((row) => row.asset_ref)),
          new Set([
            "cosmetics/dice/football/attack.webp",
            "cosmetics/dice/football/defense.webp",
            "cosmetics/dice/football/neutral.webp",
          ]),
        );

        const assets = await db.query(
          `SELECT role,object_key,mime_type,active
             FROM catalog.collection_assets
            WHERE collection_id='collection.football'
              AND active=TRUE
            ORDER BY role`,
        );
        assert.equal(assets.rowCount, 3);
        assert.deepEqual(
          new Map(assets.rows.map((row) => [row.role, row.object_key])),
          new Map([
            ["banner", "store/collections/football/banner.webp"],
            ["background", "store/collections/football/background.webp"],
            ["logo", "store/collections/football/logo.webp"],
          ]),
        );
        assert.equal(assets.rows.every((row) => row.mime_type === "image/webp"), true);

        const products = await db.query(
          `SELECT product.product_type,COUNT(*)::int AS total
             FROM catalog.products product
            WHERE product.collection_id='collection.football'
            GROUP BY product.product_type
            ORDER BY product.product_type`,
        );
        assert.deepEqual(products.rows, [
          { product_type: "bundle", total: 1 },
          { product_type: "single", total: 3 },
        ]);
      } finally {
        await db.end();
      }
    });
  });

  test("collection_assets permite histórico inativo mas bloqueia dois mappings ativos do mesmo papel", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const db = new Client({ connectionString });
      await db.connect();
      try {
        await db.query(
          `INSERT INTO catalog.collection_assets(
             collection_id,role,object_key,mime_type,active
           ) VALUES(
             'collection.football','banner','store/collections/football/banner-v0.webp','image/webp',FALSE
           )`,
        );

        await assert.rejects(
          db.query(
            `INSERT INTO catalog.collection_assets(
               collection_id,role,object_key,mime_type,active
             ) VALUES(
               'collection.football','banner','store/collections/football/banner-v2.webp','image/webp',TRUE
             )`,
          ),
          (error) => error?.code === "23505",
        );

        await assert.rejects(
          db.query(
            `INSERT INTO catalog.collection_assets(
               collection_id,role,object_key,mime_type,active
             ) VALUES(
               'collection.football','hero','store/collections/football/hero.webp','image/webp',FALSE
             )`,
          ),
          (error) => error?.code === "23514",
        );
      } finally {
        await db.end();
      }
    });
  });

  test("modelo representa coleção mista sem converter produto ou coleção em ownership", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const db = new Client({ connectionString });
      await db.connect();
      try {
        await db.query(
          `INSERT INTO catalog.collections(id,slug,name,description,active,sort_order)
           VALUES('collection.test-mixed','test-mixed','Fixture mista','Somente para integração',TRUE,9999)`,
        );
        await db.query(
          `INSERT INTO catalog.collection_assets(collection_id,role,object_key,mime_type,active)
           VALUES
             ('collection.test-mixed','banner','store/collections/test-mixed/banner.webp','image/webp',TRUE),
             ('collection.test-mixed','background','store/collections/test-mixed/background.webp','image/webp',TRUE),
             ('collection.test-mixed','logo','store/collections/test-mixed/logo.webp','image/webp',TRUE)`,
        );
        await db.query(
          `UPDATE catalog.cosmetics
              SET collection_id='collection.test-mixed'
            WHERE id IN ('dice.attack.exercito','territory.effect.azulejo-brasil')`,
        );

        const composition = await db.query(
          `SELECT slot,COUNT(*)::int AS total
             FROM catalog.cosmetics
            WHERE collection_id='collection.test-mixed'
            GROUP BY slot
            ORDER BY slot`,
        );
        assert.deepEqual(composition.rows, [
          { slot: "dice_attack", total: 1 },
          { slot: "territory_skin", total: 1 },
        ]);

        const ownershipTables = await db.query(
          `SELECT COUNT(*)::int AS total
             FROM inventory.cosmetics owned
             JOIN catalog.cosmetics item ON item.id=owned.cosmetic_id
            WHERE item.collection_id='collection.test-mixed'`,
        );
        assert.equal(ownershipTables.rows[0].total, 0);
      } finally {
        await db.end();
      }
    });
  });

  test("STORE-16: campanha expira sem remover coleção, cosméticos ou oferta estável", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const db = new Client({ connectionString });
      await db.connect();
      try {
        await db.query(
          `INSERT INTO catalog.campaigns(
             id,slug,title,description,starts_at,ends_at,priority,active
           ) VALUES(
             'campaign.test-football','test-football','Operação Futebol','Fixture editorial',
             CURRENT_TIMESTAMP - INTERVAL '1 hour',
             CURRENT_TIMESTAMP + INTERVAL '1 hour',
             1,TRUE
           )`,
        );
        await db.query(
          `INSERT INTO catalog.campaign_offers(campaign_id,offer_id,position)
           VALUES('campaign.test-football','offer.futebol',0)`,
        );
        await db.query(
          `INSERT INTO catalog.campaign_assets(campaign_id,role,object_key,mime_type)
           VALUES(
             'campaign.test-football','hero','store/campaigns/test-football/hero.webp','image/webp'
           )`,
        );

        const active = await db.query(
          `SELECT campaign.id,membership.offer_id
             FROM catalog.campaigns campaign
             JOIN catalog.campaign_offers membership ON membership.campaign_id=campaign.id
            WHERE campaign.id='campaign.test-football'
              AND campaign.active=TRUE
              AND campaign.starts_at <= CURRENT_TIMESTAMP
              AND campaign.ends_at > CURRENT_TIMESTAMP`,
        );
        assert.deepEqual(active.rows, [
          { id: "campaign.test-football", offer_id: "offer.futebol" },
        ]);

        await db.query(
          `UPDATE catalog.campaigns
              SET ends_at=CURRENT_TIMESTAMP - INTERVAL '1 second'
            WHERE id='campaign.test-football'`,
        );
        const expired = await db.query(
          `SELECT id
             FROM catalog.campaigns
            WHERE id='campaign.test-football'
              AND active=TRUE
              AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)`,
        );
        assert.equal(expired.rowCount, 0);

        const persistentCatalogue = await db.query(
          `SELECT collection.id,
                  COUNT(DISTINCT item.id)::int AS cosmetics,
                  COUNT(DISTINCT product.id)::int AS products
             FROM catalog.collections collection
             JOIN catalog.cosmetics item ON item.collection_id=collection.id
             JOIN catalog.products product ON product.collection_id=collection.id
            WHERE collection.id='collection.football'
            GROUP BY collection.id`,
        );
        assert.deepEqual(persistentCatalogue.rows, [
          { id: "collection.football", cosmetics: 3, products: 4 },
        ]);

        const roles = await db.query(
          `SELECT role
             FROM catalog.collection_assets
            WHERE collection_id='collection.football' AND active=TRUE
            ORDER BY role`,
        );
        assert.deepEqual(roles.rows.map((row) => row.role), [
          "background",
          "banner",
          "logo",
        ]);
      } finally {
        await db.end();
      }
    });
  });
}
