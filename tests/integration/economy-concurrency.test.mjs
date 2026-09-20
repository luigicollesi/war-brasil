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
  const name = `war_economy_concurrency_${suffix}`;
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

async function prepareDatabase(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(readFileSync("src/lib/db/schema.sql", "utf8"));
  } finally {
    await client.end();
  }
  runPrepare(connectionString);
}

async function connect(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
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

async function lockCommander(client, userId) {
  const result = await client.query(
    `SELECT user_id
       FROM profile.commanders
      WHERE user_id=$1::uuid
      FOR UPDATE`,
    [userId],
  );
  assert.equal(result.rowCount, 1);
}

async function initializeEconomy(client, userId) {
  await client.query(
    `INSERT INTO economy.wallets(user_id,currency_code,balance)
     VALUES($1::uuid,'campaign-credit',0)
     ON CONFLICT (user_id,currency_code) DO NOTHING`,
    [userId],
  );
  await client.query(
    `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
     SELECT $1::uuid,item.id,item.slot,'default'
       FROM catalog.cosmetics item
      WHERE item.is_default=TRUE
     ON CONFLICT (user_id,cosmetic_id) DO NOTHING`,
    [userId],
  );
  await client.query(
    `INSERT INTO profile.cosmetic_loadout(user_id,slot,cosmetic_id)
     SELECT $1::uuid,item.slot,item.id
       FROM catalog.cosmetics item
      WHERE item.is_default=TRUE
     ON CONFLICT (user_id,slot) DO NOTHING`,
    [userId],
  );
}

async function initializeTransaction(client, userId) {
  await client.query("BEGIN");
  try {
    await lockCommander(client, userId);
    await initializeEconomy(client, userId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function grantTestCosmetics(client, userId) {
  const cosmetics = [
    ["dice.attack.exercito", "dice_attack"],
    ["dice.attack.lancas", "dice_attack"],
    ["dice.defense.exercito", "dice_defense"],
  ];
  await client.query(
    `UPDATE catalog.cosmetics
        SET status='available'
      WHERE id=ANY($1::text[])`,
    [cosmetics.map(([id]) => id)],
  );
  for (const [cosmeticId, slot] of cosmetics) {
    await client.query(
      `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
       VALUES($1,$2,$3,'admin')
       ON CONFLICT (user_id,cosmetic_id) DO NOTHING`,
      [userId, cosmeticId, slot],
    );
  }
}

async function equipInOpenTransaction(client, userId, slot, cosmeticId) {
  await client.query(
    `INSERT INTO profile.cosmetic_loadout(user_id,slot,cosmetic_id,updated_at)
     VALUES($1,$2,$3,NOW())
     ON CONFLICT (user_id,slot) DO UPDATE
     SET cosmetic_id=EXCLUDED.cosmetic_id,
         updated_at=NOW()`,
    [userId, slot, cosmeticId],
  );
}

async function createRoom(client) {
  const result = await client.query(
    `INSERT INTO game.rooms(code)
     VALUES($1)
     RETURNING id`,
    [`Q${Math.random().toString(36).slice(2, 7).toUpperCase()}`],
  );
  return result.rows[0].id;
}

async function createHumanSeat(client, roomId, userId) {
  const result = await client.query(
    `INSERT INTO game.players(
       room_id,player_session,faction_name,color,user_id,display_name_snapshot,handle_snapshot
     )
     VALUES($1,$2,'Humanos','forest',$3,'Humano','humano')
     RETURNING id`,
    [roomId, randomUUID(), userId],
  );
  return result.rows[0].id;
}

async function createBotSeat(client, roomId) {
  await client.query(
    `INSERT INTO game.players(
       room_id,player_session,faction_name,color,is_ready,is_bot
     )
     VALUES($1,$2,'Bots','ocean',TRUE,TRUE)`,
    [roomId, randomUUID()],
  );
}

async function lockRoomCommanders(client, roomId) {
  await client.query(
    `SELECT commander.user_id
       FROM profile.commanders commander
       JOIN game.players player ON player.user_id=commander.user_id
      WHERE player.room_id=$1
        AND player.user_id IS NOT NULL
      ORDER BY commander.user_id
      FOR UPDATE OF commander`,
    [roomId],
  );
}

async function captureRoomCosmetics(client, roomId) {
  await client.query(
    `WITH defaults AS (
       SELECT id,slot,asset_ref,effect_key
         FROM catalog.cosmetics
        WHERE is_default=TRUE
     ),
     resolved AS (
       SELECT player.id AS player_id,
              defaults.slot,
              COALESCE(equipped.id,defaults.id) AS cosmetic_id,
              CASE WHEN equipped.id IS NOT NULL THEN equipped.asset_ref ELSE defaults.asset_ref END AS asset_ref,
              CASE WHEN equipped.id IS NOT NULL THEN equipped.effect_key ELSE defaults.effect_key END AS effect_key
         FROM game.players player
         CROSS JOIN defaults
         LEFT JOIN profile.cosmetic_loadout loadout
           ON loadout.user_id=player.user_id
          AND loadout.slot=defaults.slot
         LEFT JOIN catalog.cosmetics equipped
           ON equipped.id=loadout.cosmetic_id
          AND equipped.slot=loadout.slot
        WHERE player.room_id=$1
     )
     INSERT INTO game.player_cosmetic_loadouts(
       player_id,slot,cosmetic_id,asset_ref,effect_key,captured_at
     )
     SELECT player_id,slot,cosmetic_id,asset_ref,effect_key,NOW()
       FROM resolved
     ON CONFLICT (player_id,slot) DO UPDATE
     SET cosmetic_id=EXCLUDED.cosmetic_id,
         asset_ref=EXCLUDED.asset_ref,
         effect_key=EXCLUDED.effect_key,
         captured_at=EXCLUDED.captured_at`,
    [roomId],
  );
}

if (!databaseUrl) {
  test("economy concurrency exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("duas inicializações simultâneas mantêm wallet zero e quatro defaults únicos", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      const first = await connect(connectionString);
      const second = await connect(connectionString);
      try {
        const userId = await createCommander(setup, "ConcurrentInit");

        await Promise.all([
          initializeTransaction(first, userId),
          initializeTransaction(second, userId),
        ]);

        const wallet = await setup.query(
          `SELECT COUNT(*)::int AS total,MIN(balance)::text AS balance
             FROM economy.wallets
            WHERE user_id=$1 AND currency_code='campaign-credit'`,
          [userId],
        );
        assert.deepEqual(wallet.rows[0], { total: 1, balance: "0" });

        const inventory = await setup.query(
          `SELECT COUNT(*)::int AS total
             FROM inventory.cosmetics
            WHERE user_id=$1`,
          [userId],
        );
        assert.equal(inventory.rows[0].total, 4);

        const loadout = await setup.query(
          `SELECT COUNT(*)::int AS total
             FROM profile.cosmetic_loadout
            WHERE user_id=$1`,
          [userId],
        );
        assert.equal(loadout.rows[0].total, 4);

        const ledger = await setup.query(
          `SELECT COUNT(*)::int AS total
             FROM economy.ledger_entries
            WHERE user_id=$1`,
          [userId],
        );
        assert.equal(ledger.rows[0].total, 0);
      } finally {
        await Promise.all([setup.end(), first.end(), second.end()]);
      }
    });
  });

  test("equipagens concorrentes são serializadas e preservam slots independentes", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      const first = await connect(connectionString);
      const second = await connect(connectionString);
      try {
        const userId = await createCommander(setup, "ConcurrentEquip");
        await initializeTransaction(setup, userId);
        await grantTestCosmetics(setup, userId);

        await first.query("BEGIN");
        await lockCommander(first, userId);
        const secondSameSlot = (async () => {
          await second.query("BEGIN");
          try {
            await lockCommander(second, userId);
            await equipInOpenTransaction(
              second,
              userId,
              "dice_attack",
              "dice.attack.lancas",
            );
            await second.query("COMMIT");
          } catch (error) {
            await second.query("ROLLBACK");
            throw error;
          }
        })();

        await equipInOpenTransaction(
          first,
          userId,
          "dice_attack",
          "dice.attack.exercito",
        );
        await first.query("COMMIT");
        await secondSameSlot;

        let loadout = await setup.query(
          `SELECT slot,cosmetic_id
             FROM profile.cosmetic_loadout
            WHERE user_id=$1
            ORDER BY slot`,
          [userId],
        );
        assert.equal(
          loadout.rows.find((row) => row.slot === "dice_attack").cosmetic_id,
          "dice.attack.lancas",
        );
        assert.equal(
          loadout.rows.find((row) => row.slot === "dice_defense").cosmetic_id,
          "dice.defense.default",
        );

        await first.query("BEGIN");
        await lockCommander(first, userId);
        const secondDifferentSlot = (async () => {
          await second.query("BEGIN");
          try {
            await lockCommander(second, userId);
            await equipInOpenTransaction(
              second,
              userId,
              "dice_defense",
              "dice.defense.exercito",
            );
            await second.query("COMMIT");
          } catch (error) {
            await second.query("ROLLBACK");
            throw error;
          }
        })();

        await equipInOpenTransaction(
          first,
          userId,
          "dice_attack",
          "dice.attack.exercito",
        );
        await first.query("COMMIT");
        await secondDifferentSlot;

        loadout = await setup.query(
          `SELECT slot,cosmetic_id
             FROM profile.cosmetic_loadout
            WHERE user_id=$1
            ORDER BY slot`,
          [userId],
        );
        const bySlot = new Map(loadout.rows.map((row) => [row.slot, row.cosmetic_id]));
        assert.equal(bySlot.get("dice_attack"), "dice.attack.exercito");
        assert.equal(bySlot.get("dice_defense"), "dice.defense.exercito");
        assert.equal(bySlot.get("dice_neutral"), "dice.neutral.default");
        assert.equal(bySlot.get("territory_skin"), "territory.effect.default");

        const money = await setup.query(
          `SELECT wallet.balance::text AS balance,
                  (SELECT COUNT(*)::int FROM economy.ledger_entries ledger WHERE ledger.user_id=wallet.user_id) AS ledger_entries
             FROM economy.wallets wallet
            WHERE wallet.user_id=$1 AND wallet.currency_code='campaign-credit'`,
          [userId],
        );
        assert.deepEqual(money.rows[0], { balance: "0", ledger_entries: 0 });
      } finally {
        await Promise.all([setup.end(), first.end(), second.end()]);
      }
    });
  });

  test("captura de partida e equipagem concorrente possuem boundary linearizável", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      const match = await connect(connectionString);
      const equip = await connect(connectionString);
      try {
        const userId = await createCommander(setup, "MatchBoundary");
        await initializeTransaction(setup, userId);
        await grantTestCosmetics(setup, userId);
        const roomId = await createRoom(setup);
        const playerId = await createHumanSeat(setup, roomId, userId);
        await createBotSeat(setup, roomId);

        await match.query("BEGIN");
        await lockRoomCommanders(match, roomId);
        const equipAfterMatch = (async () => {
          await equip.query("BEGIN");
          try {
            await lockCommander(equip, userId);
            await equipInOpenTransaction(
              equip,
              userId,
              "dice_attack",
              "dice.attack.exercito",
            );
            await equip.query("COMMIT");
          } catch (error) {
            await equip.query("ROLLBACK");
            throw error;
          }
        })();

        await captureRoomCosmetics(match, roomId);
        await match.query("COMMIT");
        await equipAfterMatch;

        let frozen = await setup.query(
          `SELECT cosmetic_id
             FROM game.player_cosmetic_loadouts
            WHERE player_id=$1 AND slot='dice_attack'`,
          [playerId],
        );
        assert.equal(frozen.rows[0].cosmetic_id, "dice.attack.default");

        let profile = await setup.query(
          `SELECT cosmetic_id
             FROM profile.cosmetic_loadout
            WHERE user_id=$1 AND slot='dice_attack'`,
          [userId],
        );
        assert.equal(profile.rows[0].cosmetic_id, "dice.attack.exercito");

        await setup.query(
          `DELETE FROM game.player_cosmetic_loadouts
            WHERE player_id IN (SELECT id FROM game.players WHERE room_id=$1)`,
          [roomId],
        );
        await setup.query(
          `UPDATE profile.cosmetic_loadout
              SET cosmetic_id='dice.attack.default',updated_at=NOW()
            WHERE user_id=$1 AND slot='dice_attack'`,
          [userId],
        );

        await equip.query("BEGIN");
        await lockCommander(equip, userId);
        const matchAfterEquip = (async () => {
          await match.query("BEGIN");
          try {
            await lockRoomCommanders(match, roomId);
            await captureRoomCosmetics(match, roomId);
            await match.query("COMMIT");
          } catch (error) {
            await match.query("ROLLBACK");
            throw error;
          }
        })();

        await equipInOpenTransaction(
          equip,
          userId,
          "dice_attack",
          "dice.attack.lancas",
        );
        await equip.query("COMMIT");
        await matchAfterEquip;

        frozen = await setup.query(
          `SELECT cosmetic_id
             FROM game.player_cosmetic_loadouts
            WHERE player_id=$1 AND slot='dice_attack'`,
          [playerId],
        );
        assert.equal(frozen.rows[0].cosmetic_id, "dice.attack.lancas");

        profile = await setup.query(
          `SELECT cosmetic_id
             FROM profile.cosmetic_loadout
            WHERE user_id=$1 AND slot='dice_attack'`,
          [userId],
        );
        assert.equal(profile.rows[0].cosmetic_id, "dice.attack.lancas");
      } finally {
        await Promise.all([setup.end(), match.end(), equip.end()]);
      }
    });
  });
}
