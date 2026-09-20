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
  const name = `war_game_cosmetics_${suffix}`;
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
     VALUES($1,'campaign-credit',0)
     ON CONFLICT DO NOTHING`,
    [userId],
  );

  await client.query(
    `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
     SELECT $1,item.id,item.slot,'default'
       FROM catalog.cosmetics item
      WHERE item.is_default=TRUE
     ON CONFLICT DO NOTHING`,
    [userId],
  );

  await client.query(
    `INSERT INTO profile.cosmetic_loadout(user_id,slot,cosmetic_id)
     SELECT $1,item.slot,item.id
       FROM catalog.cosmetics item
      WHERE item.is_default=TRUE
     ON CONFLICT (user_id,slot) DO NOTHING`,
    [userId],
  );

  return userId;
}

async function createRoom(client) {
  const room = await client.query(
    `INSERT INTO game.rooms(code)
     VALUES($1)
     RETURNING id`,
    [`C${Math.random().toString(36).slice(2, 7).toUpperCase()}`],
  );
  return room.rows[0].id;
}

async function createHumanSeat(client, roomId, userId) {
  const player = await client.query(
    `INSERT INTO game.players(
       room_id,player_session,faction_name,color,user_id,display_name_snapshot,handle_snapshot
     )
     VALUES($1,$2,'Humanos','forest',$3,'Humano','humano')
     RETURNING id`,
    [roomId, randomUUID(), userId],
  );
  return player.rows[0].id;
}

async function createBotSeat(client, roomId) {
  const player = await client.query(
    `INSERT INTO game.players(
       room_id,player_session,faction_name,color,is_ready,is_bot
     )
     VALUES($1,$2,'Bots','ocean',TRUE,TRUE)
     RETURNING id`,
    [roomId, randomUUID()],
  );
  return player.rows[0].id;
}

if (!databaseUrl) {
  test("game cosmetic snapshot migration exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("039 congela loadout humano e permanece compatível após canonicalização territory_skin", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const client = new Client({ connectionString });
      await client.connect();

      try {
        assert.ok(upStart >= 0, "migration 039 precisa manter marcador -- Up Migration");
        assert.ok(migrationSql.length > 0, "migration 039 precisa possuir SQL de up");

        const userId = await createCommander(client, "CosmeticSnapshot");
        const roomId = await createRoom(client);
        const humanPlayerId = await createHumanSeat(client, roomId, userId);
        const botPlayerId = await createBotSeat(client, roomId);

        await client.query(
          `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
           VALUES($1,'dice.attack.exercito','dice_attack','admin')`,
          [userId],
        );
        await client.query(
          `UPDATE profile.cosmetic_loadout
              SET cosmetic_id='dice.attack.exercito',updated_at=NOW()
            WHERE user_id=$1 AND slot='dice_attack'`,
          [userId],
        );

        // 039 foi aplicada pelo runner antes dos assentos existirem. Reexecutar o
        // SQL simula o backfill de deploy sobre uma sala já existente; os slots
        // são derivados do catálogo já migrado pela 043.
        await client.query(migrationSql);

        const humanRows = await client.query(
          `SELECT slot,cosmetic_id,asset_ref,effect_key
             FROM game.player_cosmetic_loadouts
            WHERE player_id=$1
            ORDER BY slot`,
          [humanPlayerId],
        );
        assert.equal(humanRows.rowCount, 4);
        assert.deepEqual(
          humanRows.rows.find((row) => row.slot === "dice_attack"),
          {
            slot: "dice_attack",
            cosmetic_id: "dice.attack.exercito",
            asset_ref: "cosmetics/dice/military-classic/attack.webp",
            effect_key: null,
          },
        );

        const botRows = await client.query(
          `SELECT slot,cosmetic_id
             FROM game.player_cosmetic_loadouts
            WHERE player_id=$1
            ORDER BY slot`,
          [botPlayerId],
        );
        assert.equal(botRows.rowCount, 4);
        assert.deepEqual(
          new Map(botRows.rows.map((row) => [row.slot, row.cosmetic_id])),
          new Map([
            ["dice_attack", "dice.attack.default"],
            ["dice_defense", "dice.defense.default"],
            ["dice_neutral", "dice.neutral.default"],
            ["territory_skin", "territory.effect.default"],
          ]),
        );

        // Alterações de Profile e até do catálogo não podem reescrever uma
        // partida que já teve seu snapshot capturado.
        await client.query(
          `UPDATE profile.cosmetic_loadout
              SET cosmetic_id='dice.attack.default',updated_at=NOW()
            WHERE user_id=$1 AND slot='dice_attack'`,
          [userId],
        );
        await client.query(
          `UPDATE catalog.cosmetics
              SET asset_ref='cosmetics/dice/military-classic-v2/attack.webp'
            WHERE id='dice.attack.exercito'`,
        );
        await client.query(migrationSql);

        const frozen = await client.query(
          `SELECT cosmetic_id,asset_ref,effect_key
             FROM game.player_cosmetic_loadouts
            WHERE player_id=$1 AND slot='dice_attack'`,
          [humanPlayerId],
        );
        assert.deepEqual(frozen.rows[0], {
          cosmetic_id: "dice.attack.exercito",
          asset_ref: "cosmetics/dice/military-classic/attack.webp",
          effect_key: null,
        });
      } finally {
        await client.end();
      }
    });
  });
}
