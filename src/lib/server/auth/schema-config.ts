import { betterAuth } from "better-auth";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL é obrigatória para gerar o schema de autenticação.");
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
