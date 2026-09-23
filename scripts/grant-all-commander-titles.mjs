import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { Client } from "pg";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) loadEnvFile(envFile);
}

const accountId = process.argv[2]?.trim();
if (!accountId) {
  console.error(
    "Uso: npm run titles:grant-all -- <accountId>",
  );
  process.exit(1);
}

const connectionString =
  process.env.AUTH_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error(
    "AUTH_DATABASE_URL ou DATABASE_URL é obrigatória para conceder títulos.",
  );
  process.exit(1);
}

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query("BEGIN");

  const accounts = await client.query(
    `SELECT DISTINCT "userId"::text AS user_id
       FROM auth."account"
      WHERE "accountId"=$1`,
    [accountId],
  );

  const userIds = accounts.rows
    .map((row) => String(row.user_id))
    .filter(Boolean);

  if (userIds.length !== 1) {
    throw new Error(
      userIds.length === 0
        ? "Nenhuma conta corresponde ao accountId informado."
        : "O accountId informado está associado a mais de um usuário.",
    );
  }

  const userId = userIds[0];

  await client.query(
    `INSERT INTO catalog.commander_title_stats(title_id, acquisition_count)
     SELECT id, 0
       FROM catalog.commander_titles
     ON CONFLICT (title_id) DO NOTHING`,
  );

  const grant = await client.query(
    `WITH granted AS (
       INSERT INTO profile.commander_titles(
         user_id,
         title_id,
         acquisition_source
       )
       SELECT $1::uuid,
              title.id,
              'admin'
         FROM catalog.commander_titles title
        WHERE title.is_active=TRUE
       ON CONFLICT (user_id, title_id) DO NOTHING
       RETURNING title_id
     ),
     updated_stats AS (
       UPDATE catalog.commander_title_stats stats
          SET acquisition_count=stats.acquisition_count + 1,
              updated_at=NOW()
        WHERE stats.title_id IN (SELECT title_id FROM granted)
        RETURNING stats.title_id
     )
     SELECT
       (SELECT COUNT(*)::int FROM granted) AS granted_count,
       (SELECT COUNT(*)::int FROM updated_stats) AS updated_stats_count`,
    [userId],
  );

  const ownership = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE title.is_active=TRUE)::int AS owned_active,
       (SELECT COUNT(*)::int
          FROM catalog.commander_titles
         WHERE is_active=TRUE) AS active_total
       FROM profile.commander_titles owned
       JOIN catalog.commander_titles title
         ON title.id=owned.title_id
      WHERE owned.user_id=$1::uuid`,
    [userId],
  );

  const result = grant.rows[0] ?? {};
  const state = ownership.rows[0] ?? {};

  if (Number(state.owned_active) !== Number(state.active_total)) {
    throw new Error(
      "Grant incompleto: ownership ativo não corresponde ao catálogo ativo.",
    );
  }

  await client.query("COMMIT");

  console.log(
    `[war-brasil] títulos concedidos: ${Number(result.granted_count ?? 0)} novos; ` +
      `${Number(state.owned_active ?? 0)}/${Number(state.active_total ?? 0)} ativos possuídos.`,
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(
    "[war-brasil] falha ao conceder títulos:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
