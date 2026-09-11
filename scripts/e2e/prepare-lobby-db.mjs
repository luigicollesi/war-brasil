import { readFileSync } from "node:fs";
import { Client } from "pg";

const adminDatabaseUrl = process.env.DATABASE_URL;
const lobbyDatabaseUrl = process.env.LOBBY_E2E_DATABASE_URL;

if (!adminDatabaseUrl || !lobbyDatabaseUrl) {
  throw new Error("DATABASE_URL e LOBBY_E2E_DATABASE_URL são obrigatórias para o E2E do Lobby.");
}

const targetUrl = new URL(lobbyDatabaseUrl);
const databaseName = targetUrl.pathname.replace(/^\//, "");

if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error(`Nome de banco E2E inválido: ${databaseName}`);
}

const admin = new Client({ connectionString: adminDatabaseUrl });
await admin.connect();

try {
  await admin.query(
    `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
      WHERE datname = $1
        AND pid <> pg_backend_pid()`,
    [databaseName],
  );
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  await admin.query(`CREATE DATABASE "${databaseName}"`);
} finally {
  await admin.end();
}

const target = new Client({ connectionString: lobbyDatabaseUrl });
await target.connect();

try {
  await target.query(readFileSync("src/lib/db/schema.sql", "utf8"));
  console.log(`[war-brasil] banco E2E do Lobby preparado: ${databaseName}`);
} finally {
  await target.end();
}
