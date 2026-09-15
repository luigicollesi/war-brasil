import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  const name = `war_store_shapes_${suffix}`;
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

async function createUser(client, label) {
  const result = await client.query(
    `INSERT INTO auth."user"(name,email,"emailVerified")
     VALUES($1,$2,TRUE)
     RETURNING id`,
    [label, `${label.toLowerCase()}-${randomUUID()}@example.invalid`],
  );
  const userId = result.rows[0].id;
  await client.query(
    `INSERT INTO profile.commanders(user_id,handle,display_name)
     VALUES($1,$2,$3)`,
    [userId, `${label.toLowerCase()}_${randomUUID().slice(0, 8)}`, label],
  );
  return userId;
}

async function own(client, userId, cosmeticIds) {
  if (cosmeticIds.length === 0) return;
  await client.query(
    `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
     SELECT $1::uuid,item.id,item.slot,'promotion'
       FROM catalog.cosmetics item
      WHERE item.id=ANY($2::text[])
     ON CONFLICT (user_id,cosmetic_id) DO NOTHING`,
    [userId, cosmeticIds],
  );
}

async function quoteMixedBundle(client, userId) {
  const result = await client.query(
    `WITH composition AS (
       SELECT item.id,
              pricing.fixed_price::bigint AS price,
              (owned.cosmetic_id IS NOT NULL) AS owned
         FROM catalog.product_items membership
         JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
         JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
         LEFT JOIN inventory.cosmetics owned
           ON owned.user_id=$1::uuid
          AND owned.cosmetic_id=item.id
        WHERE membership.product_id='product.test-mixed'
     ), totals AS (
       SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE owned)::int AS owned_count,
              COALESCE(SUM(price) FILTER (WHERE NOT owned),0)::bigint AS subtotal
         FROM composition
     )
     SELECT total,
            owned_count,
            subtotal::text AS subtotal,
            ((subtotal * 9000) / 10000)::bigint::text AS final_price
       FROM totals`,
    [userId],
  );
  return result.rows[0];
}

if (!databaseUrl) {
  test("storefront shape integration exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("STORE-06: schema representa coleção territory-only com contrato editorial V1", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const db = new Client({ connectionString });
      await db.connect();
      try {
        await db.query(
          `INSERT INTO catalog.collections(id,slug,name,description,active,sort_order)
           VALUES('collection.test-territory','test-territory','Territory only','Fixture',TRUE,9000)`,
        );
        await db.query(
          `INSERT INTO catalog.collection_assets(collection_id,role,object_key,mime_type,active)
           VALUES
             ('collection.test-territory','banner','store/collections/test-territory/banner.webp','image/webp',TRUE),
             ('collection.test-territory','background','store/collections/test-territory/background.webp','image/webp',TRUE),
             ('collection.test-territory','logo','store/collections/test-territory/logo.webp','image/webp',TRUE)`,
        );
        await db.query(
          `UPDATE catalog.cosmetics
              SET collection_id='collection.test-territory'
            WHERE id IN (
              'territory.effect.azulejo-brasil',
              'territory.effect.azulejo-ornamental'
            )`,
        );

        const shape = await db.query(
          `SELECT COUNT(DISTINCT item.id)::int AS total,
                  COUNT(DISTINCT item.id) FILTER (WHERE item.slot='territory_skin')::int AS territory_items,
                  COUNT(DISTINCT asset.role)::int AS roles
             FROM catalog.collections collection
             JOIN catalog.cosmetics item ON item.collection_id=collection.id
             JOIN catalog.collection_assets asset
               ON asset.collection_id=collection.id AND asset.active=TRUE
            WHERE collection.id='collection.test-territory'`,
        );
        assert.deepEqual(shape.rows, [
          { total: 2, territory_items: 2, roles: 3 },
        ]);
      } finally {
        await db.end();
      }
    });
  });

  test("STORE-10: mixed collection completion excludes owned dice and territory skins", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const db = new Client({ connectionString });
      await db.connect();
      try {
        await db.query(
          `INSERT INTO catalog.collections(id,slug,name,description,active,sort_order)
           VALUES('collection.test-mixed','test-mixed','Mixed completion','Fixture',TRUE,9001)`,
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
            WHERE id IN (
              'dice.attack.exercito',
              'dice.defense.exercito',
              'territory.effect.azulejo-brasil'
            )`,
        );
        await db.query(
          `INSERT INTO catalog.products(
             id,collection_id,slug,name,description,product_type,bundle_discount_bps,active
           ) VALUES(
             'product.test-mixed','collection.test-mixed','test-mixed-bundle','Mixed bundle','Fixture','bundle',1000,TRUE
           )`,
        );
        await db.query(
          `INSERT INTO catalog.product_items(product_id,cosmetic_id,position)
           VALUES
             ('product.test-mixed','dice.attack.exercito',0),
             ('product.test-mixed','dice.defense.exercito',1),
             ('product.test-mixed','territory.effect.azulejo-brasil',2)`,
        );

        const diceOnly = await createUser(db, "MixedDiceOnly");
        await own(db, diceOnly, ["dice.attack.exercito", "dice.defense.exercito"]);
        assert.deepEqual(await quoteMixedBundle(db, diceOnly), {
          total: 3,
          owned_count: 2,
          subtotal: "300",
          final_price: "270",
        });

        const skinOnly = await createUser(db, "MixedSkinOnly");
        await own(db, skinOnly, ["territory.effect.azulejo-brasil"]);
        assert.deepEqual(await quoteMixedBundle(db, skinOnly), {
          total: 3,
          owned_count: 1,
          subtotal: "300",
          final_price: "270",
        });

        const mixed = await createUser(db, "MixedPartial");
        await own(db, mixed, ["dice.attack.exercito", "territory.effect.azulejo-brasil"]);
        assert.deepEqual(await quoteMixedBundle(db, mixed), {
          total: 3,
          owned_count: 2,
          subtotal: "150",
          final_price: "135",
        });

        const full = await createUser(db, "MixedFull");
        await own(db, full, [
          "dice.attack.exercito",
          "dice.defense.exercito",
          "territory.effect.azulejo-brasil",
        ]);
        assert.deepEqual(await quoteMixedBundle(db, full), {
          total: 3,
          owned_count: 3,
          subtotal: "0",
          final_price: "0",
        });
      } finally {
        await db.end();
      }
    });
  });

  test("STORE-15/16: produto retorna em rotação por nova offer sem recriar cosmetic/product", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const db = new Client({ connectionString });
      await db.connect();
      try {
        const productId = "product.single.dice.attack.exercito";
        const cosmeticId = "dice.attack.exercito";
        const original = "offer.single.dice.attack.exercito";

        await db.query(
          `UPDATE catalog.offers
              SET ends_at=CURRENT_TIMESTAMP - INTERVAL '1 minute'
            WHERE id=$1`,
          [original],
        );
        await db.query(
          `INSERT INTO catalog.offers(
             id,slug,name,description,currency_code,price,status,is_featured,sort_order,
             product_id,pricing_model,starts_at,ends_at,active,priority
           ) VALUES(
             'offer.test-return','test-return','Retorno','Nova rotação',
             'campaign-credit',150,'available',FALSE,9998,
             $1,'itemized',CURRENT_TIMESTAMP - INTERVAL '1 minute',
             CURRENT_TIMESTAMP + INTERVAL '1 hour',TRUE,9998
           )`,
          [productId],
        );

        const activeOffers = await db.query(
          `SELECT offer.id,offer.product_id,membership.cosmetic_id
             FROM catalog.offers offer
             JOIN catalog.product_items membership ON membership.product_id=offer.product_id
            WHERE offer.product_id=$1
              AND offer.active=TRUE
              AND offer.status='available'
              AND (offer.starts_at IS NULL OR offer.starts_at <= CURRENT_TIMESTAMP)
              AND (offer.ends_at IS NULL OR offer.ends_at > CURRENT_TIMESTAMP)
            ORDER BY offer.id`,
          [productId],
        );
        assert.deepEqual(activeOffers.rows, [
          {
            id: "offer.test-return",
            product_id: productId,
            cosmetic_id: cosmeticId,
          },
        ]);

        const identities = await db.query(
          `SELECT
             (SELECT COUNT(*)::int FROM catalog.products WHERE id=$1) AS products,
             (SELECT COUNT(*)::int FROM catalog.cosmetics WHERE id=$2) AS cosmetics`,
          [productId, cosmeticId],
        );
        assert.deepEqual(identities.rows, [{ products: 1, cosmetics: 1 }]);
      } finally {
        await db.end();
      }
    });
  });
}
