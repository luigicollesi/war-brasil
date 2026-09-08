import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { Client } from "pg";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) loadEnvFile(envFile);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "[war-brasil] DATABASE_URL não está configurada para preparar o banco local.",
  );
  process.exit(1);
}

const migrationsDir = resolve("src/lib/db/migrations/managed");
const migrationNamePattern = /^\d{3}-[a-z0-9-]+\.sql$/;
const client = new Client({ connectionString });

function managedMigrationFiles() {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function migrationUpSql(fileName) {
  if (!migrationNamePattern.test(fileName)) {
    throw new Error(
      `Migration gerenciada com nome inválido: ${fileName}. Use NNN-descricao.sql.`,
    );
  }

  const source = readFileSync(resolve(migrationsDir, fileName), "utf8");
  const upMarker = "-- Up Migration";
  const downMarker = "-- Down Migration";
  const upIndex = source.indexOf(upMarker);
  if (upIndex < 0) {
    throw new Error(`Migration ${fileName} não possui marcador ${upMarker}.`);
  }

  const downIndex = source.indexOf(downMarker, upIndex + upMarker.length);
  const sql = source
    .slice(
      upIndex + upMarker.length,
      downIndex >= 0 ? downIndex : source.length,
    )
    .trim();

  if (!sql) {
    throw new Error(`Migration ${fileName} não possui comandos de up.`);
  }
  return sql;
}

function assertMigrationHistory(files, appliedNames) {
  const fileSet = new Set(files);
  for (const appliedName of appliedNames) {
    if (!fileSet.has(appliedName)) {
      throw new Error(
        `Migration já aplicada foi removida do repositório: ${appliedName}.`,
      );
    }
  }

  for (let index = 0; index < appliedNames.length; index += 1) {
    if (files[index] !== appliedNames[index]) {
      throw new Error(
        `Ordem de migrations inválida: ${files[index] ?? "<ausente>"} precede ${appliedNames[index]}.`,
      );
    }
  }
}

async function assertMigrationBaseline() {
  const stateResult = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname='game_rooms'
          AND c.relkind IN ('r', 'p')
      ) AS legacy,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='game' AND c.relname='game_rooms'
          AND c.relkind IN ('r', 'p')
      ) AS organized,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='game' AND c.relname='rooms'
          AND c.relkind IN ('r', 'p')
      ) AS normalized
  `);

  const state = stateResult.rows[0];
  const activeStates = [state?.legacy, state?.organized, state?.normalized].filter(
    Boolean,
  ).length;

  if (activeStates === 0) {
    throw new Error(
      "Schema base não encontrado. Inicialize o banco com src/lib/db/schema.sql antes de usar o ambiente de desenvolvimento.",
    );
  }
  if (activeStates > 1) {
    throw new Error(
      "Estado de banco ambíguo: existem tabelas físicas de rooms em mais de uma etapa da migração.",
    );
  }

  // Bancos já organizados manualmente ou criados pelo schema canônico serão
  // validados pelas próprias migrations 026/027. O preflight detalhado abaixo
  // existe apenas para impedir que um banco public.* anterior à v025 seja movido
  // como se estivesse completo.
  if (!state.legacy) return;

  const requiredTables = await client.query(`
    WITH expected(table_name) AS (
      VALUES
        ('game_rooms'),
        ('room_players'),
        ('game_territories'),
        ('game_order_rolls'),
        ('game_rematch_votes'),
        ('game_player_objectives'),
        ('game_cards'),
        ('game_player_trade_offers'),
        ('game_round_events'),
        ('objectives'),
        ('objective_rules'),
        ('events'),
        ('event_connections'),
        ('bot_names'),
        ('territory_card_symbols'),
        ('territory_connections'),
        ('game_command_receipts')
    )
    SELECT COALESCE(
      array_agg(expected.table_name ORDER BY expected.table_name)
        FILTER (WHERE c.oid IS NULL),
      ARRAY[]::text[]
    ) AS missing
    FROM expected
    LEFT JOIN pg_namespace n ON n.nspname='public'
    LEFT JOIN pg_class c
      ON c.relnamespace=n.oid
     AND c.relname=expected.table_name
     AND c.relkind IN ('r', 'p')
  `);
  const missingTables = requiredTables.rows[0]?.missing ?? [];

  const requiredColumns = await client.query(`
    WITH expected(table_name, column_name) AS (
      VALUES
        ('game_rooms', 'initial_territory_presentation_started_at'),
        ('game_rooms', 'automation_due_at'),
        ('game_rooms', 'automation_kind'),
        ('game_rooms', 'automation_claimed_by'),
        ('game_rooms', 'automation_claimed_until'),
        ('game_rooms', 'trade_offers_used'),
        ('room_players', 'is_bot'),
        ('room_players', 'card_trade_count'),
        ('room_players', 'trade_signals_used'),
        ('room_players', 'bot_next_action_at'),
        ('game_command_receipts', 'response_patch'),
        ('game_command_receipts', 'response_private_patch'),
        ('game_player_trade_offers', 'offered_kind'),
        ('game_player_trade_offers', 'offered_territory_id'),
        ('game_player_trade_offers', 'offered_symbol'),
        ('game_player_trade_offers', 'counter_offered_kind'),
        ('game_player_trade_offers', 'counter_requested_kind'),
        ('game_player_trade_offers', 'accepted_terms'),
        ('game_player_trade_offers', 'proposer_selected_card_id'),
        ('game_player_trade_offers', 'responder_selected_card_id')
    )
    SELECT COALESCE(
      array_agg(expected.table_name || '.' || expected.column_name
                ORDER BY expected.table_name, expected.column_name)
        FILTER (WHERE columns.column_name IS NULL),
      ARRAY[]::text[]
    ) AS missing
    FROM expected
    LEFT JOIN information_schema.columns columns
      ON columns.table_schema='public'
     AND columns.table_name=expected.table_name
     AND columns.column_name=expected.column_name
  `);
  const missingColumns = requiredColumns.rows[0]?.missing ?? [];

  const tradeConstraintNames = [
    "game_player_trade_offers_status_check",
    "game_player_trade_offers_offered_descriptor_check",
    "game_player_trade_offers_counter_descriptor_check",
    "game_player_trade_offers_responder_check",
    "game_player_trade_offers_state_check",
  ];
  const tradeConstraints = await client.query(
    `SELECT conname
       FROM pg_constraint
      WHERE conrelid=to_regclass('public.game_player_trade_offers')
        AND conname = ANY($1::text[])`,
    [tradeConstraintNames],
  );
  const existingTradeConstraints = new Set(
    tradeConstraints.rows.map((row) => String(row.conname)),
  );
  const missingConstraints = tradeConstraintNames.filter(
    (name) => !existingTradeConstraints.has(name),
  );

  const phaseConstraintResult = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid=to_regclass('public.game_rooms')
        AND c.contype='c'
        AND pg_get_constraintdef(c.oid) LIKE '%phase%'
        AND pg_get_constraintdef(c.oid) LIKE '%status%'
        AND pg_get_constraintdef(c.oid) LIKE '%cards%'
        AND pg_get_constraintdef(c.oid) LIKE '%order_roll%'
    ) AS compatible
  `);
  const phaseCompatible = Boolean(phaseConstraintResult.rows[0]?.compatible);

  const problems = [];
  if (missingTables.length > 0) {
    problems.push(`tabelas ausentes: ${missingTables.join(", ")}`);
  }
  if (missingColumns.length > 0) {
    problems.push(`colunas ausentes: ${missingColumns.join(", ")}`);
  }
  if (missingConstraints.length > 0) {
    problems.push(`constraints ausentes: ${missingConstraints.join(", ")}`);
  }
  if (!phaseCompatible) {
    problems.push("game_rooms_phase_check não contém a compatibilidade da migration 024");
  }

  if (problems.length > 0) {
    throw new Error(
      `Banco legado não corresponde ao baseline v025: ${problems.join("; ")}. ` +
        "Alinhe primeiro o banco ao estado dev/v025 antes de aplicar as migrations gerenciadas.",
    );
  }
}

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(20260906, 26)");
  await client.query("CREATE SCHEMA IF NOT EXISTS ops");
  await client.query(`
    CREATE TABLE IF NOT EXISTS ops.pgmigrations (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      run_on TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await assertMigrationBaseline();

  const files = managedMigrationFiles();
  const appliedResult = await client.query(
    "SELECT name FROM ops.pgmigrations ORDER BY id",
  );
  const appliedNames = appliedResult.rows.map((row) => String(row.name));
  assertMigrationHistory(files, appliedNames);

  for (const fileName of files.slice(appliedNames.length)) {
    await client.query(migrationUpSql(fileName));
    await client.query(
      "INSERT INTO ops.pgmigrations(name) VALUES($1)",
      [fileName],
    );
    console.log(`[war-brasil] migration aplicada: ${fileName}`);
  }

  await client.query("COMMIT");
  console.log("[war-brasil] banco local alinhado às migrations gerenciadas.");
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
