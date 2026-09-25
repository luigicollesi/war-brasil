import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

function urlForDatabase(name) {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function withTemporaryDatabase(label, callback) {
  const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const name = `war_${label}_${suffix}`;
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

test(
  "launch catalog promotes built-in defaults while premium collections remain commercial",
  { skip: !databaseUrl },
  async () => {
    await withTemporaryDatabase("store_launch", async (connectionString) => {
      await prepareDatabase(connectionString);
      const client = new Client({ connectionString });
      await client.connect();
      try {
        const simpleSilver = await client.query(`
          SELECT id, slot, asset_ref, collection_id, status
          FROM catalog.cosmetics
          WHERE id LIKE 'dice.%.simple-silver'
          ORDER BY slot
        `);
        assert.equal(simpleSilver.rowCount, 3);
        assert.deepEqual(
          new Set(simpleSilver.rows.map((row) => row.asset_ref)),
          new Set([
            "cosmetics/dice/simple-silver/attack.webp",
            "cosmetics/dice/simple-silver/defense.webp",
            "cosmetics/dice/simple-silver/neutral.webp",
          ]),
        );
        assert.ok(simpleSilver.rows.every((row) => row.collection_id === null));
        assert.ok(simpleSilver.rows.every((row) => row.status === "retired"));

        const defaultDice = await client.query(`
          SELECT id, slot, asset_ref, status, is_default
          FROM catalog.cosmetics
          WHERE id IN (
            'dice.attack.default',
            'dice.defense.default',
            'dice.neutral.default'
          )
          ORDER BY slot
        `);
        assert.equal(defaultDice.rowCount, 3);
        assert.deepEqual(
          new Set(defaultDice.rows.map((row) => row.asset_ref)),
          new Set([
            "cosmetics/dice/default/attack.webp",
            "cosmetics/dice/default/defense.webp",
            "cosmetics/dice/default/neutral.webp",
          ]),
        );
        assert.ok(
          defaultDice.rows.every(
            (row) => row.status === "available" && row.is_default === true,
          ),
        );

        const brazilDice = await client.query(`
          SELECT id, slot, asset_ref, status, is_default
          FROM catalog.cosmetics
          WHERE id IN (
            'dice.attack.brazil',
            'dice.defense.brazil',
            'dice.neutral.brazil'
          )
          ORDER BY slot
        `);
        assert.equal(brazilDice.rowCount, 3);
        assert.deepEqual(
          new Set(brazilDice.rows.map((row) => row.asset_ref)),
          new Set([
            "cosmetics/dice/brazil/attack.webp",
            "cosmetics/dice/brazil/defense.webp",
            "cosmetics/dice/brazil/neutral.webp",
          ]),
        );
        assert.ok(
          brazilDice.rows.every(
            (row) => row.status === "available" && row.is_default === false,
          ),
        );

        const pricing = await client.query(`
          SELECT split_part(cosmetic_id, '.', 3) AS theme,
                 MIN(fixed_price)::bigint AS min_price,
                 MAX(fixed_price)::bigint AS max_price
          FROM catalog.cosmetic_pricing
          WHERE cosmetic_id ~ '^dice\\.(attack|defense|neutral)\\.(exercito|lancas|gato|viking|futebol|cachorro)$'
          GROUP BY split_part(cosmetic_id, '.', 3)
          ORDER BY theme
        `);
        const prices = Object.fromEntries(
          pricing.rows.map((row) => [row.theme, Number(row.min_price)]),
        );
        assert.deepEqual(prices, {
          cachorro: 500,
          exercito: 150,
          futebol: 500,
          gato: 500,
          lancas: 150,
          viking: 500,
        });
        assert.ok(pricing.rows.every((row) => row.min_price === row.max_price));

        const bundles = await client.query(`
          SELECT id, collection_id, bundle_discount_bps, active
          FROM catalog.products
          WHERE id IN (
            'product.simple-silver', 'product.exercito', 'product.lancas',
            'product.gato', 'product.viking', 'product.futebol', 'product.cachorro'
          )
          ORDER BY id
        `);
        const byId = Object.fromEntries(bundles.rows.map((row) => [row.id, row]));
        assert.equal(byId["product.simple-silver"].collection_id, null);
        assert.equal(byId["product.simple-silver"].bundle_discount_bps, 1111);
        assert.equal(byId["product.simple-silver"].active, false);
        for (const id of ["product.exercito", "product.lancas"]) {
          assert.equal(byId[id].collection_id, null);
          assert.equal(byId[id].bundle_discount_bps, 1111);
          assert.equal(byId[id].active, true);
        }
        for (const [id, collectionId] of [
          ["product.gato", "collection.cat"],
          ["product.viking", "collection.viking"],
          ["product.futebol", "collection.football"],
        ]) {
          assert.equal(byId[id].collection_id, collectionId);
          assert.equal(byId[id].bundle_discount_bps, 2000);
          assert.equal(byId[id].active, true);
        }
        assert.equal(byId["product.cachorro"].collection_id, "collection.dog");
        assert.equal(byId["product.cachorro"].bundle_discount_bps, 2000);
        assert.equal(byId["product.cachorro"].active, true);

        const offers = await client.query(`
          SELECT id, price, status, active, starts_at, ends_at
          FROM catalog.offers
          WHERE id IN (
            'offer.simple-silver', 'offer.exercito', 'offer.lancas',
            'offer.gato', 'offer.viking', 'offer.futebol', 'offer.cachorro'
          )
          ORDER BY id
        `);
        const offerById = Object.fromEntries(offers.rows.map((row) => [row.id, row]));
        assert.equal(Number(offerById["offer.simple-silver"].price), 400);
        assert.equal(offerById["offer.simple-silver"].status, "retired");
        assert.equal(offerById["offer.simple-silver"].active, false);
        assert.equal(offerById["offer.simple-silver"].starts_at, null);
        assert.equal(offerById["offer.simple-silver"].ends_at, null);
        for (const id of ["offer.exercito", "offer.lancas"]) {
          assert.equal(Number(offerById[id].price), 400);
          assert.equal(offerById[id].status, "available");
          assert.equal(offerById[id].active, true);
          assert.equal(offerById[id].starts_at, null);
          assert.equal(offerById[id].ends_at, null);
        }
        for (const id of ["offer.gato", "offer.viking", "offer.futebol"]) {
          assert.equal(Number(offerById[id].price), 1200);
          assert.equal(offerById[id].status, "available");
          assert.equal(offerById[id].active, true);
        }
        assert.equal(Number(offerById["offer.cachorro"].price), 1200);
        assert.equal(offerById["offer.cachorro"].status, "available");
        assert.equal(offerById["offer.cachorro"].active, true);

        const collections = await client.query(`
          SELECT id, active
          FROM catalog.collections
          WHERE id IN (
            'collection.military-classic', 'collection.medieval-spears',
            'collection.cat', 'collection.viking', 'collection.football', 'collection.dog',
            'collection.ceu-noturno'
          )
          ORDER BY id
        `);
        const collectionById = Object.fromEntries(
          collections.rows.map((row) => [row.id, row.active]),
        );
        assert.deepEqual(collectionById, {
          "collection.cat": true,
          "collection.ceu-noturno": true,
          "collection.dog": true,
          "collection.football": true,
          "collection.medieval-spears": false,
          "collection.military-classic": false,
          "collection.viking": true,
        });

        const assets = await client.query(`
          SELECT collection_id, role, object_key
          FROM catalog.collection_assets
          WHERE active
            AND collection_id IN (
              'collection.cat', 'collection.viking', 'collection.football',
              'collection.dog', 'collection.ceu-noturno'
            )
          ORDER BY collection_id, role
        `);
        assert.equal(assets.rowCount, 15);
        for (const collection of ["cat", "viking", "football", "dog", "ceu-noturno"]) {
          for (const role of ["banner", "background", "logo"]) {
            assert.ok(
              assets.rows.some(
                (row) =>
                  row.collection_id === `collection.${collection}` &&
                  row.role === role &&
                  row.object_key === `store/collections/${collection}/${role}.webp`,
              ),
            );
          }
        }

        const cosmicNightDice = await client.query(`
          SELECT item.id,
                 item.asset_ref,
                 item.collection_id,
                 pricing.fixed_price::bigint AS fixed_price,
                 offer.id AS offer_id,
                 offer.status AS offer_status,
                 offer.active AS offer_active
          FROM catalog.cosmetics item
          JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
          JOIN catalog.products product
            ON product.id='product.single.' || item.id
           AND product.active=TRUE
          JOIN catalog.offers offer
            ON offer.id='offer.single.' || item.id
           AND offer.product_id=product.id
          WHERE item.id IN (
            'dice.attack.ceu-noturno',
            'dice.defense.ceu-noturno',
            'dice.neutral.ceu-noturno'
          )
          ORDER BY item.id
        `);
        assert.equal(cosmicNightDice.rowCount, 3);
        assert.deepEqual(
          new Set(cosmicNightDice.rows.map((row) => row.asset_ref)),
          new Set([
            "cosmetics/dice/ceu-noturno/attack.webp",
            "cosmetics/dice/ceu-noturno/defense.webp",
            "cosmetics/dice/ceu-noturno/neutral.webp",
          ]),
        );
        assert.ok(
          cosmicNightDice.rows.every(
            (row) =>
              row.collection_id === "collection.ceu-noturno" &&
              Number(row.fixed_price) === 500 &&
              row.offer_status === "available" &&
              row.offer_active === true,
          ),
        );

        const cosmicNightBundle = await client.query(`
          SELECT offer.price::bigint AS price,
                 offer.status,
                 offer.active,
                 product.bundle_discount_bps,
                 COUNT(membership.cosmetic_id)::int AS item_count
          FROM catalog.offers offer
          JOIN catalog.products product ON product.id=offer.product_id
          JOIN catalog.product_items membership ON membership.product_id=product.id
          WHERE offer.id='offer.ceu-noturno'
          GROUP BY offer.price,offer.status,offer.active,product.bundle_discount_bps
        `);
        assert.equal(cosmicNightBundle.rowCount, 1);
        assert.equal(Number(cosmicNightBundle.rows[0].price), 1600);
        assert.equal(cosmicNightBundle.rows[0].status, "available");
        assert.equal(cosmicNightBundle.rows[0].active, true);
        assert.equal(cosmicNightBundle.rows[0].bundle_discount_bps, 2000);
        assert.equal(cosmicNightBundle.rows[0].item_count, 4);

        const territoryPricing = await client.query(`
          SELECT item.id, item.collection_id, pricing.fixed_price::bigint AS fixed_price
          FROM catalog.cosmetics item
          JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
          WHERE item.slot='territory_skin'
            AND item.is_default=FALSE
          ORDER BY item.id
        `);
        const territoryById = Object.fromEntries(
          territoryPricing.rows.map((row) => [row.id, row]),
        );
        assert.equal(
          territoryById["territory.effect.ceu-estrelado"].collection_id,
          "collection.ceu-noturno",
        );
        assert.equal(
          Number(territoryById["territory.effect.ceu-estrelado"].fixed_price),
          500,
        );
        for (const id of [
          "territory.effect.azulejo-brasil",
          "territory.effect.azulejo-ornamental",
          "territory.effect.solar-ornamental",
        ]) {
          assert.equal(territoryById[id].collection_id, null);
          assert.equal(Number(territoryById[id].fixed_price), 300);
        }

        const missingOfferCoverage = await client.query(`
          SELECT item.id
          FROM catalog.cosmetics item
          LEFT JOIN catalog.product_items membership
            ON membership.cosmetic_id=item.id
           AND membership.product_id='product.single.' || item.id
          LEFT JOIN catalog.products product
            ON product.id=membership.product_id
          LEFT JOIN catalog.offers offer
            ON offer.product_id=product.id
           AND offer.id='offer.single.' || item.id
           AND offer.status='available'
           AND offer.active=TRUE
          WHERE item.is_default=FALSE
            AND item.status IN ('announced','available')
            AND item.id NOT IN (
              'dice.attack.brazil',
              'dice.defense.brazil',
              'dice.neutral.brazil'
            )
            AND (product.id IS NULL OR product.active=FALSE OR offer.id IS NULL)
          ORDER BY item.id
        `);
        assert.deepEqual(missingOfferCoverage.rows, []);

        const brazilCommerce = await client.query(`
          SELECT item.id,
                 COALESCE(product.active,FALSE) AS product_active,
                 COALESCE(offer.active,FALSE) AS offer_active
          FROM catalog.cosmetics item
          LEFT JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
          LEFT JOIN catalog.products product
            ON product.id='product.single.' || item.id
          LEFT JOIN catalog.offers offer
            ON offer.id='offer.single.' || item.id
          WHERE item.id IN (
            'dice.attack.brazil',
            'dice.defense.brazil',
            'dice.neutral.brazil'
          )
          ORDER BY item.id
        `);
        assert.equal(brazilCommerce.rowCount, 3);
        assert.ok(
          brazilCommerce.rows.every(
            (row) =>
              row.product_active === false &&
              row.offer_active === false,
          ),
        );

      } finally {
        await client.end();
      }
    });
  },
);
