import { betterAuth } from "better-auth";
import { Pool } from "pg";

const databaseUrl =
  process.env.AUTH_DATABASE_URL?.trim() ?? process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    "AUTH_DATABASE_URL ou DATABASE_URL é obrigatória para gerar o schema de autenticação.",
  );
}

function isNeonPooledConnectionString(value: string) {
  try {
    const url = new URL(value);
    return (
      url.hostname.endsWith(".neon.tech") &&
      url.hostname.split(".")[0]?.endsWith("-pooler")
    );
  } catch {
    return false;
  }
}

if (isNeonPooledConnectionString(databaseUrl)) {
  throw new Error(
    "A geração/migração do schema auth exige conexão Neon direta. Configure AUTH_DATABASE_URL com hostname sem -pooler.",
  );
}

const schemaPool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  options: "-c search_path=auth",
});

// Configuração deliberadamente mínima e CLI-only. Providers sociais, email
// delivery e secrets não alteram o core schema e permanecem em auth.ts.
export const auth = betterAuth({
  database: schemaPool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  advanced: {
    database: {
      generateId: "uuid",
      joins: true,
    },
  },
});
