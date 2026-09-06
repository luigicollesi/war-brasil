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

  const baseSchema = await client.query(`
    SELECT
      to_regclass('public.game_rooms') IS NOT NULL
      OR to_regclass('game.game_rooms') IS NOT NULL AS exists
  `);
  if (!baseSchema.rows[0]?.exists) {
    throw new Error(
      "Schema base não encontrado. Inicialize o banco com src/lib/db/schema.sql antes de usar o ambiente de desenvolvimento.",
    );
  }

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
