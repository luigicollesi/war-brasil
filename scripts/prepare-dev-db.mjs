import { existsSync, readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { Client } from "pg";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("[war-brasil] DATABASE_URL não está configurada para preparar o banco local.");
  process.exit(1);
}

const client = new Client({ connectionString });

async function tableExists(tableName) {
  const result = await client.query(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [`public.${tableName}`],
  );
  return Boolean(result.rows[0]?.exists);
}

async function columnExists(tableName, columnName) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema='public'
         AND table_name=$1
         AND column_name=$2
     ) AS exists`,
    [tableName, columnName],
  );
  return Boolean(result.rows[0]?.exists);
}

async function queryHasRows(sql) {
  const result = await client.query(sql);
  return (result.rowCount ?? 0) > 0;
}

async function applyMigration(file) {
  await client.query(readFileSync(`src/lib/db/migrations/${file}`, "utf8"));
  console.log(`[war-brasil] migration aplicada: ${file}`);
}

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(20260901, 3)");

  if (!(await tableExists("room_players")) || !(await tableExists("objectives"))) {
    throw new Error(
      "Schema base não encontrado. Inicialize o banco com src/lib/db/schema.sql antes de usar o ambiente de desenvolvimento.",
    );
  }

  if (
    !(await columnExists("room_players", "is_bot")) ||
    !(await tableExists("bot_names"))
  ) {
    await applyMigration("011-bot-players.sql");
  }

  if (!(await columnExists("room_players", "bot_next_action_at"))) {
    await applyMigration("012-bot-automation.sql");
  }

  if (
    !(await tableExists("objective_rules")) ||
    !(await columnExists("game_player_objectives", "objective_rule_id")) ||
    !(await columnExists("game_player_objectives", "resolved_params"))
  ) {
    await applyMigration("013-objective-rules.sql");
  }

  const balancedCatalogReady = await queryHasRows(
    `SELECT 1
     FROM objectives objective
     WHERE objective.id='balanced_territory_control'
       AND objective.is_active=TRUE
       AND EXISTS (
         SELECT 1
         FROM objective_rules rule
         WHERE rule.objective_id=objective.id
           AND rule.is_active=TRUE
       )
     LIMIT 1`,
  );

  if (!balancedCatalogReady) {
    await applyMigration("014-balanced-objective-catalog.sql");
  }

  if (!(await columnExists("room_players", "card_trade_count"))) {
    await applyMigration("015-player-card-trade-count.sql");
  }

  const eliminationFallbackExists = await queryHasRows(
    `SELECT 1
     FROM objectives
     WHERE type IN ('elimination', 'elimination_plus')
       AND fallback_objective_id IS NOT NULL
     LIMIT 1`,
  );

  if (eliminationFallbackExists) {
    await applyMigration("016-disable-elimination-fallback.sql");
  }

  if (
    !(await columnExists("game_rooms", "initial_territory_presentation_started_at")) ||
    !(await columnExists("game_territories", "initial_draw_order"))
  ) {
    await applyMigration("017-initial-territory-presentation.sql");
  }

  if (
    !(await columnExists("game_rooms", "automation_due_at")) ||
    !(await columnExists("game_rooms", "automation_kind"))
  ) {
    await applyMigration("018-game-automation-schedule.sql");
  }

  if (!(await tableExists("game_command_receipts"))) {
    await applyMigration("019-game-command-receipts.sql");
  }

  await client.query("COMMIT");
  console.log(
    "[war-brasil] banco local preparado para bots, objetivos, apresentação inicial, agenda de automação e receipts de comandos.",
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(
    "[war-brasil] falha ao preparar o banco local:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
