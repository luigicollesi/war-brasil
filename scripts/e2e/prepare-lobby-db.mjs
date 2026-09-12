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

const schemaSql = readFileSync("src/lib/db/schema.sql", "utf8");
const balancedObjectivesSql = readFileSync(
  "src/lib/db/migrations/014-balanced-objective-catalog.sql",
  "utf8",
);

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
  await target.query("BEGIN");
  await target.query(schemaSql);

  // O schema canônico contém as estruturas atuais, enquanto a migration 014 é
  // a autoridade do catálogo de objetivos balanceados. O search_path faz a
  // migration histórica gravar diretamente nas tabelas catalog.* atuais.
  await target.query("SET LOCAL search_path TO catalog, public");
  await target.query(balancedObjectivesSql);

  // O E2E precisa de um baralho territorial completo para atravessar startGame.
  // A distribuição exata das artes não faz parte deste teste; mantemos 14 cartas
  // de cada símbolo para um fixture completo e determinístico.
  await target.query(`
    INSERT INTO catalog.territory_card_symbols (territory_id, symbol)
    SELECT
      territory_id,
      (ARRAY['leaf', 'gold', 'water']::text[])[((territory_id - 1) % 3) + 1]
    FROM generate_series(1, 42) AS territory_id
    ON CONFLICT (territory_id) DO UPDATE
      SET symbol = EXCLUDED.symbol
  `);

  const catalogState = (
    await target.query(`
      SELECT
        (SELECT COUNT(*)::int
           FROM catalog.objective_rules
          WHERE player_count = 2 AND is_active = TRUE) AS two_player_objectives,
        (SELECT COUNT(*)::int
           FROM catalog.territory_card_symbols) AS territory_symbols,
        (SELECT COUNT(*)::int
           FROM catalog.dice_balance_settings) AS dice_settings
    `)
  ).rows[0];

  if ((catalogState?.two_player_objectives ?? 0) < 2) {
    throw new Error("Catálogo E2E não possui objetivos balanceados suficientes para 2 jogadores.");
  }
  if (catalogState?.territory_symbols !== 42) {
    throw new Error(
      `Catálogo E2E deveria possuir 42 símbolos territoriais; encontrou ${catalogState?.territory_symbols ?? 0}.`,
    );
  }
  if ((catalogState?.dice_settings ?? 0) !== 1) {
    throw new Error("Configuração de dados adaptativos ausente no banco E2E.");
  }

  await target.query("COMMIT");
  console.log(
    `[war-brasil] banco E2E do Lobby preparado: ${databaseName} ` +
      `(${catalogState.two_player_objectives} objetivos para 2 jogadores, ` +
      `${catalogState.territory_symbols} símbolos territoriais)`,
  );
} catch (error) {
  await target.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await target.end();
}
