import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const preEconomyHistory = [
  "026-organize-database-schemas.sql",
  "027-normalize-schema-table-names.sql",
  "028-normalize-rooms-phase-constraint.sql",
  "029-adaptive-combat-dice.sql",
  "030-repair-adaptive-dice-state-schema.sql",
  "031-auth-foundation.sql",
  "032-profile-identity-game-binding.sql",
  "033-auth-rate-limit.sql",
  "034-profile-v3-foundation.sql",
  "035-social-graph.sql",
  "036-match-history-snapshots.sql",
  "037-profile-remove-portraits.sql",
];

function migrationUpSql(path) {
  const source = readFileSync(path, "utf8");
  const upMarker = "-- Up Migration";
  const downMarker = "-- Down Migration";
  const upStart = source.indexOf(upMarker);
  const downStart = source.indexOf(downMarker, upStart + upMarker.length);
  assert.ok(upStart >= 0, `${path} precisa manter marcador -- Up Migration`);
  return source
    .slice(upStart + upMarker.length, downStart >= 0 ? downStart : source.length)
    .trim();
}

function urlForDatabase(name) {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function withTemporaryDatabase(callback) {
  const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const name = `war_economy_${suffix}`;
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

function runPrepare(connectionString) {
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

async function prepareDatabaseThrough037(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(readFileSync("tests/fixtures/db/schema-v025.sql", "utf8"));
    await client.query(
      readFileSync("tests/fixtures/db/schema-v025-supplement.sql", "utf8"),
    );
    await client.query("CREATE SCHEMA IF NOT EXISTS ops");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ops.pgmigrations (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        run_on TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const name of preEconomyHistory) {
      await client.query("BEGIN");
      try {
        await client.query(
          migrationUpSql(`src/lib/db/migrations/managed/${name}`),
        );
        await client.query("INSERT INTO ops.pgmigrations(name) VALUES($1)", [name]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

async function createCommander(client, label) {
  const user = await client.query(
    `INSERT INTO auth."user"(name,email,"emailVerified")
     VALUES($1,$2,TRUE)
     RETURNING id`,
    [label, `${label.toLowerCase()}-${Date.now()}-${Math.random()}@example.invalid`],
  );
  const userId = user.rows[0].id;
  await client.query(
    `INSERT INTO profile.commanders(user_id,handle,display_name)
     VALUES($1,$2,$3)`,
    [userId, `${label.toLowerCase()}_${Math.floor(Math.random() * 1_000_000)}`, label],
  );
  return userId;
}

async function createPreEconomyCommander(connectionString, label) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await createCommander(client, label);
  } finally {
    await client.end();
  }
}

if (!databaseUrl) {
  test("economy migration exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("038→043 converge catálogo, Storefront V2, territory skins e backfill idempotente", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabaseThrough037(connectionString);
      const userId = await createPreEconomyCommander(
        connectionString,
        "EconomyBackfill",
      );

      runPrepare(connectionString);
      runPrepare(connectionString);

      const client = new Client({ connectionString });
      await client.connect();
      try {
        const currencies = await client.query(
          `SELECT code,display_name,symbol,is_active
             FROM economy.currencies
            ORDER BY code`,
        );
        assert.deepEqual(currencies.rows, [
          {
            code: "campaign-credit",
            display_name: "Créditos de Campanha",
            symbol: "◈",
            is_active: true,
          },
        ]);

        const catalog = await client.query(
          `SELECT
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE is_default)::int AS defaults,
             COUNT(*) FILTER (WHERE status='available')::int AS available,
             COUNT(*) FILTER (WHERE status='announced')::int AS announced,
             COUNT(*) FILTER (WHERE NOT is_default AND status='available')::int AS commercial
             FROM catalog.cosmetics`,
        );
        assert.deepEqual(catalog.rows[0], {
          total: 26,
          defaults: 4,
          available: 22,
          announced: 4,
          commercial: 18,
        });

        const sets = await client.query(
          `SELECT cosmetic_set.id,
                  cosmetic_set.storage_slug,
                  cosmetic_set.status,
                  cosmetic_set.sort_order,
                  COUNT(item.cosmetic_id)::int AS items
             FROM catalog.cosmetic_sets cosmetic_set
             LEFT JOIN catalog.cosmetic_set_items item ON item.set_id=cosmetic_set.id
            GROUP BY cosmetic_set.id,cosmetic_set.storage_slug,cosmetic_set.status,cosmetic_set.sort_order
            ORDER BY cosmetic_set.sort_order,cosmetic_set.id`,
        );
        assert.equal(sets.rowCount, 6);
        assert.deepEqual(sets.rows.map((row) => row.items), [3, 3, 3, 3, 3, 3]);

        const collections = await client.query(
          `SELECT collection.id,collection.slug,COUNT(item.id)::int AS items
             FROM catalog.collections collection
             LEFT JOIN catalog.cosmetics item ON item.collection_id=collection.id
            GROUP BY collection.id,collection.slug
            ORDER BY collection.id`,
        );
        assert.equal(collections.rowCount, 6);
        assert.deepEqual(collections.rows.map((row) => row.items), [3, 3, 3, 3, 3, 3]);

        const products = await client.query(
          `SELECT product.product_type,
                  COUNT(DISTINCT product.id)::int AS products,
                  MIN(product.bundle_discount_bps)::int AS min_discount,
                  MAX(product.bundle_discount_bps)::int AS max_discount
             FROM catalog.products product
            GROUP BY product.product_type
            ORDER BY product.product_type`,
        );
        assert.deepEqual(products.rows, [
          {
            product_type: "bundle",
            products: 6,
            min_discount: 1111,
            max_discount: 1111,
          },
          {
            product_type: "single",
            products: 18,
            min_discount: 0,
            max_discount: 0,
          },
        ]);

        const productComposition = await client.query(
          `SELECT product.product_type,
                  MIN(item_count)::int AS min_items,
                  MAX(item_count)::int AS max_items
             FROM catalog.products product
             JOIN (
               SELECT membership.product_id,COUNT(*)::int AS item_count
                 FROM catalog.product_items membership
                GROUP BY membership.product_id
             ) composition ON composition.product_id=product.id
            GROUP BY product.product_type
            ORDER BY product.product_type`,
        );
        assert.deepEqual(productComposition.rows, [
          { product_type: "bundle", min_items: 3, max_items: 3 },
          { product_type: "single", min_items: 1, max_items: 1 },
        ]);

        const pricing = await client.query(
          `SELECT pricing_model,
                  COUNT(*)::int AS total,
                  MIN(fixed_price)::text AS min_price,
                  MAX(fixed_price)::text AS max_price
             FROM catalog.cosmetic_pricing
            GROUP BY pricing_model`,
        );
        assert.deepEqual(pricing.rows, [
          {
            pricing_model: "fixed",
            total: 18,
            min_price: "150",
            max_price: "150",
          },
        ]);

        const offers = await client.query(
          `SELECT product.product_type,
                  COUNT(*)::int AS offers,
                  COUNT(*) FILTER (
                    WHERE offer.status='available' AND offer.active=TRUE
                  )::int AS active
             FROM catalog.offers offer
             JOIN catalog.products product ON product.id=offer.product_id
            GROUP BY product.product_type
            ORDER BY product.product_type`,
        );
        assert.deepEqual(offers.rows, [
          { product_type: "bundle", offers: 6, active: 6 },
          { product_type: "single", offers: 18, active: 18 },
        ]);

        const packs = await client.query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status='announced')::int AS announced,
                  MIN(credit_amount)::text AS min_credits,
                  MIN(price_brl_cents)::text AS min_price
             FROM catalog.credit_packs`,
        );
        assert.equal(packs.rows[0].total, 3);
        assert.equal(packs.rows[0].announced, 3);
        assert.equal(Number(packs.rows[0].min_credits) > 0, true);
        assert.equal(Number(packs.rows[0].min_price) > 0, true);

        const diceAssets = await client.query(
          `SELECT id,asset_ref
             FROM catalog.cosmetics
            WHERE slot IN ('dice_attack','dice_defense','dice_neutral')
            ORDER BY id`,
        );
        assert.equal(diceAssets.rowCount, 21);
        for (const row of diceAssets.rows) {
          assert.match(
            row.asset_ref,
            /^cosmetics\/dice\/[a-z0-9]+(?:-[a-z0-9]+)*\/(attack|defense|neutral)\.webp$/,
            row.id,
          );
        }

        const territorySkins = await client.query(
          `SELECT id,asset_ref,effect_key,status,is_default
             FROM catalog.cosmetics
            WHERE slot='territory_skin'
            ORDER BY id`,
        );
        assert.equal(territorySkins.rowCount, 5);
        const territoryById = new Map(
          territorySkins.rows.map((row) => [row.id, row]),
        );
        assert.deepEqual(territoryById.get("territory.effect.default"), {
          id: "territory.effect.default",
          asset_ref: null,
          effect_key: "default",
          status: "available",
          is_default: true,
        });

        for (const [id, assetRef] of [
          ["territory.effect.azulejo-brasil", "cosmetics/territory-skins/azulejo_brasil.webp"],
          ["territory.effect.azulejo-ornamental", "cosmetics/territory-skins/azulejo_ornamental.webp"],
          ["territory.effect.ceu-estrelado", "cosmetics/territory-skins/ceu_estrelado.webp"],
          ["territory.effect.solar-ornamental", "cosmetics/territory-skins/solar_ornamental.webp"],
        ]) {
          assert.deepEqual(territoryById.get(id), {
            id,
            asset_ref: assetRef,
            effect_key: null,
            status: "announced",
            is_default: false,
          });
        }

        const wallet = await client.query(
          `SELECT balance::text AS balance
             FROM economy.wallets
            WHERE user_id=$1 AND currency_code='campaign-credit'`,
          [userId],
        );
        assert.equal(wallet.rowCount, 1);
        assert.equal(wallet.rows[0].balance, "0");

        const inventory = await client.query(
          `SELECT COUNT(*)::int AS total
             FROM inventory.cosmetics
            WHERE user_id=$1`,
          [userId],
        );
        assert.equal(inventory.rows[0].total, 4);

        const loadout = await client.query(
          `SELECT slot,cosmetic_id
             FROM profile.cosmetic_loadout
            WHERE user_id=$1
            ORDER BY slot`,
          [userId],
        );
        assert.equal(loadout.rowCount, 4);
        assert.deepEqual(
          new Map(loadout.rows.map((row) => [row.slot, row.cosmetic_id])),
          new Map([
            ["dice_attack", "dice.attack.default"],
            ["dice_defense", "dice.defense.default"],
            ["dice_neutral", "dice.neutral.default"],
            ["territory_skin", "territory.effect.default"],
          ]),
        );

        const stats = await client.query(
          `SELECT cosmetic_id,acquisition_count::text AS acquisition_count
             FROM catalog.cosmetic_stats
            WHERE cosmetic_id='territory.effect.default'`,
        );
        assert.deepEqual(stats.rows[0], {
          cosmetic_id: "territory.effect.default",
          acquisition_count: "1",
        });

        const ledger = await client.query(
          `SELECT COUNT(*)::int AS total
             FROM economy.ledger_entries
            WHERE user_id=$1`,
          [userId],
        );
        assert.equal(ledger.rows[0].total, 0);
      } finally {
        await client.end();
      }
    });
  });

  test("constraints bloqueiam saldo, pricing, loadout e territory skins inválidos", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabaseThrough037(connectionString);
      const userId = await createPreEconomyCommander(
        connectionString,
        "EconomyConstraints",
      );
      runPrepare(connectionString);

      const client = new Client({ connectionString });
      await client.connect();
      try {
        await assert.rejects(
          client.query(
            `UPDATE economy.wallets
                SET balance=-1
              WHERE user_id=$1 AND currency_code='campaign-credit'`,
            [userId],
          ),
          (error) => error?.code === "23514",
        );

        await assert.rejects(
          client.query(`UPDATE catalog.offers SET price=0 WHERE id='offer.viking'`),
          (error) => error?.code === "23514",
        );

        await assert.rejects(
          client.query(
            `UPDATE catalog.products SET bundle_discount_bps=10001 WHERE id='product.viking'`,
          ),
          (error) => error?.code === "23514",
        );

        await assert.rejects(
          client.query(
            `UPDATE catalog.credit_packs SET price_brl_cents=0 WHERE id='credits.500'`,
          ),
          (error) => error?.code === "23514",
        );

        await assert.rejects(
          client.query(
            `UPDATE profile.cosmetic_loadout
                SET cosmetic_id='dice.attack.exercito'
              WHERE user_id=$1 AND slot='dice_attack'`,
            [userId],
          ),
          (error) => error?.code === "23503",
        );

        await assert.rejects(
          client.query(
            `UPDATE profile.cosmetic_loadout
                SET cosmetic_id='dice.attack.default'
              WHERE user_id=$1 AND slot='dice_defense'`,
            [userId],
          ),
          (error) => error?.code === "23503",
        );

        await assert.rejects(
          client.query(
            `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
             VALUES($1,'dice.attack.exercito','dice_defense','default')`,
            [userId],
          ),
          (error) => error?.code === "23503",
        );

        await assert.rejects(
          client.query(
            `UPDATE catalog.cosmetics
                SET asset_ref='/dados/exercito/ataque.svg'
              WHERE id='dice.attack.exercito'`,
          ),
          (error) => error?.code === "23514",
        );

        await assert.rejects(
          client.query(
            `INSERT INTO catalog.cosmetics(
               id,slug,name,slot,asset_ref,effect_key,status,is_default
             ) VALUES(
               'territory.effect.invalid-both','territory-invalid-both','Inválido ambos',
               'territory_skin','cosmetics/territory-skins/invalid.webp','default','draft',FALSE
             )`,
          ),
          (error) => error?.code === "23514",
        );

        await assert.rejects(
          client.query(
            `INSERT INTO catalog.cosmetics(
               id,slug,name,slot,asset_ref,effect_key,status,is_default
             ) VALUES(
               'territory.effect.invalid-empty','territory-invalid-empty','Inválido vazio',
               'territory_skin',NULL,NULL,'draft',FALSE
             )`,
          ),
          (error) => error?.code === "23514",
        );

        await assert.rejects(
          client.query(
            `INSERT INTO catalog.cosmetics(
               id,slug,name,slot,asset_ref,effect_key,status,is_default
             ) VALUES(
               'territory.effect.invalid-path','territory-invalid-path','Inválido path',
               'territory_skin','other/skin.webp',NULL,'draft',FALSE
             )`,
          ),
          (error) => error?.code === "23514",
        );

        await client.query(
          `INSERT INTO catalog.cosmetics(
             id,slug,name,slot,asset_ref,effect_key,status,is_default
           ) VALUES
             ('territory.effect.valid-procedural','territory-valid-procedural','Procedural válido',
              'territory_skin',NULL,'test-procedural','draft',FALSE),
             ('territory.effect.valid-image','territory-valid-image','Imagem válida',
              'territory_skin','cosmetics/territory-skins/test_valid.webp',NULL,'draft',FALSE)`,
        );

        const progressive = await client.query(
          `SELECT cosmetic_id FROM catalog.cosmetic_pricing ORDER BY cosmetic_id LIMIT 1`,
        );
        const cosmeticId = progressive.rows[0].cosmetic_id;
        await client.query(
          `UPDATE catalog.cosmetic_pricing
              SET pricing_model='progressive',fixed_price=NULL
            WHERE cosmetic_id=$1`,
          [cosmeticId],
        );
        await client.query(
          `INSERT INTO catalog.price_tiers(cosmetic_id,acquisitions_from,acquisitions_until,price)
           VALUES($1,0,99,500)`,
          [cosmeticId],
        );
        await assert.rejects(
          client.query(
            `INSERT INTO catalog.price_tiers(cosmetic_id,acquisitions_from,acquisitions_until,price)
             VALUES($1,99,199,575)`,
            [cosmeticId],
          ),
          (error) => error?.code === "23P01",
        );
      } finally {
        await client.end();
      }
    });
  });
}
