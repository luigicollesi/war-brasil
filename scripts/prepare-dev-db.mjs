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

const migrationFiles = [
  "src/lib/db/migrations/011-bot-players.sql",
  "src/lib/db/migrations/012-bot-automation.sql",
  "src/lib/db/migrations/013-objective-rules.sql",
  "src/lib/db/migrations/014-balanced-objective-catalog.sql",
  "src/lib/db/migrations/015-player-card-trade-count.sql",
  "src/lib/db/migrations/016-disable-elimination-fallback.sql",
];

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(20260901, 3)");

  const baseSchemaExists = await client.query(
    "SELECT to_regclass('public.room_players') AS room_players, to_regclass('public.objectives') AS objectives",
  );
  const base = baseSchemaExists.rows[0];

  if (!base?.room_players || !base?.objectives) {
    throw new Error(
      "Schema base não encontrado. Inicialize o banco com src/lib/db/schema.sql antes de usar o ambiente de desenvolvimento.",
    );
  }

  for (const file of migrationFiles) {
    await client.query(readFileSync(file, "utf8"));
  }

  await client.query("COMMIT");
  console.log("[war-brasil] banco local preparado para bots e objetivos.");
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
