import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const adminDatabaseUrl = process.env.DATABASE_URL;
const lobbyDatabaseUrl = process.env.LOBBY_E2E_DATABASE_URL;

if (!adminDatabaseUrl || !lobbyDatabaseUrl) {
  throw new Error(
    "DATABASE_URL e LOBBY_E2E_DATABASE_URL são obrigatórias para o E2E do Lobby.",
  );
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

const seedClient = new Client({ connectionString: lobbyDatabaseUrl });
await seedClient.connect();

try {
  await seedClient.query("BEGIN");
  await seedClient.query(schemaSql);

  // O schema canônico contém o baseline atual. O catálogo histórico continua
  // vindo da migration 014 para que o E2E atravesse startGame com os mesmos
  // objetivos balanceados usados pelo jogo.
  await seedClient.query("SET LOCAL search_path TO catalog, public");
  await seedClient.query(balancedObjectivesSql);

  // O evento 0 é o sentinel autoritativo de início do grafo de anomalias.
  // O schema canônico define a estrutura do catálogo, mas não popula os 38
  // eventos de produção; o E2E controlado só precisa do sentinel para registrar
  // a rodada inicial sem inventar um evento de gameplay alternativo.
  await seedClient.query(`
    INSERT INTO catalog.events (id, name, description, effects)
    VALUES (
      0,
      'Estado inicial',
      'Estado inicial do grafo de anomalias.',
      '[]'::jsonb
    )
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          effects = EXCLUDED.effects
  `);

  // O E2E precisa de um baralho territorial completo para atravessar startGame.
  // A distribuição exata das artes não faz parte deste teste; mantemos 14 cartas
  // de cada símbolo para um fixture completo e determinístico.
  await seedClient.query(`
    INSERT INTO catalog.territory_card_symbols (territory_id, symbol)
    SELECT
      territory_id,
      (ARRAY['leaf', 'gold', 'water']::text[])[((territory_id - 1) % 3) + 1]
    FROM generate_series(1, 42) AS territory_id
    ON CONFLICT (territory_id) DO UPDATE
      SET symbol = EXCLUDED.symbol
  `);

  await seedClient.query("COMMIT");
} catch (error) {
  await seedClient.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await seedClient.end();
}

// O fixture não pode manter um caminho de schema paralelo ao runtime. Depois do
// baseline, convergimos pelo mesmo ledger 026+ usado em dev/produção, incluindo
// Better Auth e o vínculo profile/account-seat das migrations 031/032.
const prepareResult = spawnSync(process.execPath, ["scripts/prepare-dev-db.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: {
    ...process.env,
    DATABASE_URL: lobbyDatabaseUrl,
  },
});

if (prepareResult.status !== 0) {
  throw new Error(
    `Falha ao convergir banco E2E pelas migrations gerenciadas:\n${prepareResult.stdout}\n${prepareResult.stderr}`,
  );
}

const validationClient = new Client({ connectionString: lobbyDatabaseUrl });
await validationClient.connect();

try {
  const state = (
    await validationClient.query(`
      SELECT
        (SELECT COUNT(*)::int
           FROM catalog.objective_rules
          WHERE player_count = 2 AND is_active = TRUE) AS two_player_objectives,
        (SELECT COUNT(*)::int
           FROM catalog.territory_card_symbols) AS territory_symbols,
        EXISTS (
          SELECT 1
          FROM catalog.events
          WHERE id = 0
        ) AS initial_event_ready,
        (SELECT COUNT(*)::int
           FROM catalog.dice_balance_settings) AS dice_settings,
        (SELECT COUNT(*)::int
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'auth'
            AND c.relkind IN ('r', 'p')
            AND c.relname = ANY(ARRAY['user','session','account','verification'])) AS auth_tables,
        (to_regclass('profile.commanders') IS NOT NULL) AS commanders_ready,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'game'
            AND table_name = 'players'
            AND column_name = 'user_id'
        ) AS seat_binding_ready,
        (SELECT COUNT(*)::int
           FROM ops.pgmigrations
          WHERE name IN (
            '031-auth-foundation.sql',
            '032-profile-identity-game-binding.sql'
          )) AS auth_migrations
    `)
  ).rows[0];

  if ((state?.two_player_objectives ?? 0) < 2) {
    throw new Error(
      "Catálogo E2E não possui objetivos balanceados suficientes para 2 jogadores.",
    );
  }
  if (state?.territory_symbols !== 42) {
    throw new Error(
      `Catálogo E2E deveria possuir 42 símbolos territoriais; encontrou ${state?.territory_symbols ?? 0}.`,
    );
  }
  if (!state?.initial_event_ready) {
    throw new Error("Evento inicial 0 ausente no catálogo E2E.");
  }
  if ((state?.dice_settings ?? 0) !== 1) {
    throw new Error("Configuração de dados adaptativos ausente no banco E2E.");
  }
  if (state?.auth_tables !== 4 || !state?.commanders_ready) {
    throw new Error(
      "Schema Better Auth/profile não convergiu no banco E2E do Lobby.",
    );
  }
  if (!state?.seat_binding_ready || state?.auth_migrations !== 2) {
    throw new Error(
      "Vínculo account+seat ou ledger 031/032 ausente no banco E2E do Lobby.",
    );
  }

  console.log(
    `[war-brasil] banco E2E do Lobby preparado: ${databaseName} ` +
      `(${state.two_player_objectives} objetivos para 2 jogadores, ` +
      `${state.territory_symbols} símbolos territoriais, evento inicial e auth/profile prontos)`,
  );
} finally {
  await validationClient.end();
}
