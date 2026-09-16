import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

function prepareDatabase(connectionString) {
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
  "047 selects Football as the only featured collection with a 40% promotion",
  { skip: !databaseUrl },
  async () => {
    await withTemporaryDatabase("collection_promo", async (connectionString) => {
      prepareDatabase(connectionString);
      const client = new Client({ connectionString });
      await client.connect();
      try {
        const collections = await client.query(`
          SELECT id, featured, promotion_discount_bps
          FROM catalog.collections
          WHERE id IN ('collection.cat', 'collection.viking', 'collection.football')
          ORDER BY id
        `);

        assert.deepEqual(collections.rows, [
          { id: "collection.cat", featured: false, promotion_discount_bps: 0 },
          {
            id: "collection.football",
            featured: true,
            promotion_discount_bps: 4000,
          },
          { id: "collection.viking", featured: false, promotion_discount_bps: 0 },
        ]);

        const featuredCount = await client.query(`
          SELECT COUNT(*)::int AS count
          FROM catalog.collections
          WHERE featured=TRUE
        `);
        assert.equal(featuredCount.rows[0].count, 1);

        const receiptColumn = await client.query(`
          SELECT column_default, is_nullable
          FROM information_schema.columns
          WHERE table_schema='economy'
            AND table_name='purchases'
            AND column_name='promotion_discount_bps'
        `);
        assert.equal(receiptColumn.rowCount, 1);
        assert.equal(receiptColumn.rows[0].is_nullable, "NO");
        assert.match(receiptColumn.rows[0].column_default, /0/);

        const history = await client.query(`
          SELECT name
          FROM ops.pgmigrations
          WHERE name='047-economy-storefront-collection-promotions.sql'
        `);
        assert.equal(history.rowCount, 1);
      } finally {
        await client.end();
      }
    });
  },
);
