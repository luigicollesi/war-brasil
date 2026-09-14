import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const migrationSource = readFileSync(
  "src/lib/db/migrations/managed/039-game-cosmetic-loadout-snapshots.sql",
  "utf8",
);
const upMarker = "-- Up Migration";
const downMarker = "-- Down Migration";
const upStart = migrationSource.indexOf(upMarker);
const downStart = migrationSource.indexOf(downMarker, upStart + upMarker.length);
const migrationSql = migrationSource
  .slice(upStart + upMarker.length, downStart >= 0 ? downStart : migrationSource.length)
  .trim();

function urlForDatabase(name) {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function withTemporaryDatabase(callback) {
  const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const name = `war_cosmetic_reconnect_${suffix}`;
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
  await client.query(
    `INSERT INTO economy.wallets(user_id,currency_code,balance)
     VALUES($1,'campaign-credit',0)`,
    [userId],
  );
  await client.query(
    `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
     SELECT $1,item.id,item.slot,'default'
       FROM catalog.cosmetics item
      WHERE item.is_default=TRUE`,
    [userId],
  );
  await client.query(
    `INSERT INTO profile.cosmetic_loadout(user_id,slot,cosmetic_id)
     SELECT $1,item.slot,item.id
       FROM catalog.cosmetics item
      WHERE item.is_default=TRUE`,
    [userId],
  );
  return userId;
}

async function grantAndEquip(client, userId, cosmeticId, slot) {
  await client.query(
    `UPDATE catalog.cosmetics
        SET status='available'
      WHERE id=$1`,
    [cosmeticId],
  );
  await client.query(
    `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
     VALUES($1,$2,$3,'admin')`,
    [userId, cosmeticId, slot],
  );
  await client.query(
    `UPDATE profile.cosmetic_loadout
        SET cosmetic_id=$2,updated_at=NOW()
      WHERE user_id=$1 AND slot=$3`,
    [userId, cosmeticId, slot],
  );
}

async function createRoom(client) {
  const room = await client.query(
    `INSERT INTO game.rooms(code)
     VALUES($1)
     RETURNING id`,
    [`R${Math.random().toString(36).slice(2, 7).toUpperCase()}`],
  );
  return room.rows[0].id;
}

async function createHumanSeat(client, roomId, userId, factionName, color) {
  const player = await client.query(
    `INSERT INTO game.players(
       room_id,player_session,faction_name,color,user_id,display_name_snapshot,handle_snapshot
     )
     VALUES($1,$2,$3,$4,$5,$3,lower($3))
     RETURNING id`,
    [roomId, randomUUID(), factionName, color, userId],
  );
  return player.rows[0].id;
}

async function readRoomCosmetics(client, roomId) {
  const result = await client.query(
    `SELECT player.id AS player_id,
            snapshot.slot,
            snapshot.cosmetic_id,
            snapshot.asset_ref,
            snapshot.effect_key
       FROM game.players player
       JOIN game.player_cosmetic_loadouts snapshot ON snapshot.player_id=player.id
      WHERE player.room_id=$1
      ORDER BY player.id,snapshot.slot`,
    [roomId],
  );
  return result.rows;
}

if (!databaseUrl) {
  test("game cosmetic reconnect exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("reconnect e clientes diferentes leem exatamente o snapshot cosmético congelado", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      const clientA = await connect(connectionString);
      const clientB = await connect(connectionString);

      try {
        const userA = await createCommander(setup, "ReconnectA");
        const userB = await createCommander(setup, "ReconnectB");
        await grantAndEquip(
          setup,
          userA,
          "dice.attack.exercito",
          "dice_attack",
        );
        await grantAndEquip(
          setup,
          userB,
          "dice.defense.lancas",
          "dice_defense",
        );

        const roomId = await createRoom(setup);
        const playerA = await createHumanSeat(
          setup,
          roomId,
          userA,
          "ReconnectA",
          "forest",
        );
        const playerB = await createHumanSeat(
          setup,
          roomId,
          userB,
          "ReconnectB",
          "ruby",
        );

        // Simula a captura de startGame sobre a sala já montada.
        await setup.query(migrationSql);

        const firstA = await readRoomCosmetics(clientA, roomId);
        const firstB = await readRoomCosmetics(clientB, roomId);
        assert.deepEqual(firstA, firstB);
        assert.equal(firstA.length, 8);

        const attackA = firstA.find(
          (row) => row.player_id === playerA && row.slot === "dice_attack",
        );
        const defenseB = firstA.find(
          (row) => row.player_id === playerB && row.slot === "dice_defense",
        );
        assert.deepEqual(attackA, {
          player_id: playerA,
          slot: "dice_attack",
          cosmetic_id: "dice.attack.exercito",
          asset_ref: "/dados/exercito/ataque.svg",
          effect_key: null,
        });
        assert.deepEqual(defenseB, {
          player_id: playerB,
          slot: "dice_defense",
          cosmetic_id: "dice.defense.lancas",
          asset_ref: "/dados/lancas/defesa.svg",
          effect_key: null,
        });

        // Profile e catálogo mudam depois do começo da partida. Uma reconexão
        // ainda deve recuperar somente game.player_cosmetic_loadouts.
        await setup.query(
          `UPDATE profile.cosmetic_loadout
              SET cosmetic_id='dice.attack.default',updated_at=NOW()
            WHERE user_id=$1 AND slot='dice_attack'`,
          [userA],
        );
        await setup.query(
          `UPDATE profile.cosmetic_loadout
              SET cosmetic_id='dice.defense.default',updated_at=NOW()
            WHERE user_id=$1 AND slot='dice_defense'`,
          [userB],
        );
        await setup.query(
          `UPDATE catalog.cosmetics
              SET asset_ref='/dados/mutado-depois-do-start.svg'
            WHERE id IN ('dice.attack.exercito','dice.defense.lancas')`,
        );

        const reconnectA = await readRoomCosmetics(clientA, roomId);
        const reconnectB = await readRoomCosmetics(clientB, roomId);
        assert.deepEqual(reconnectA, firstA);
        assert.deepEqual(reconnectB, firstA);

        const wallet = await setup.query(
          `SELECT user_id,balance::text AS balance
             FROM economy.wallets
            WHERE user_id=ANY($1::uuid[])
            ORDER BY user_id`,
          [[userA, userB]],
        );
        assert.deepEqual(
          wallet.rows.map((row) => row.balance),
          ["0", "0"],
        );
        const ledger = await setup.query(
          `SELECT COUNT(*)::int AS total
             FROM economy.ledger_entries
            WHERE user_id=ANY($1::uuid[])`,
          [[userA, userB]],
        );
        assert.equal(ledger.rows[0].total, 0);
      } finally {
        await Promise.all([setup.end(), clientA.end(), clientB.end()]);
      }
    });
  });

  test("item retired permanece resolvível em snapshot já pertencente ao usuário", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const client = await connect(connectionString);
      try {
        const userId = await createCommander(client, "RetiredOwner");
        await grantAndEquip(
          client,
          userId,
          "dice.neutral.viking",
          "dice_neutral",
        );
        await client.query(
          `UPDATE catalog.cosmetics
              SET status='retired'
            WHERE id='dice.neutral.viking'`,
        );

        const roomId = await createRoom(client);
        const playerId = await createHumanSeat(
          client,
          roomId,
          userId,
          "RetiredOwner",
          "ocean",
        );
        await client.query(migrationSql);

        const snapshot = await client.query(
          `SELECT cosmetic_id,asset_ref
             FROM game.player_cosmetic_loadouts
            WHERE player_id=$1 AND slot='dice_neutral'`,
          [playerId],
        );
        assert.deepEqual(snapshot.rows[0], {
          cosmetic_id: "dice.neutral.viking",
          asset_ref: "/dados/viking/neutro.svg",
        });
      } finally {
        await client.end();
      }
    });
  });
}
