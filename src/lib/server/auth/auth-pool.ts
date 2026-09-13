import "server-only";

import { Pool } from "pg";
import { readAuthServerEnvironment } from "./environment";

const globalForAuthPostgres = globalThis as typeof globalThis & {
  warBrasilAuthPool?: Pool;
};

function createAuthPool() {
  const { databaseUrl } = readAuthServerEnvironment();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL não está configurada para autenticação.");
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 6,
    options: "-c search_path=auth",
  });
}

export const authPool = globalForAuthPostgres.warBrasilAuthPool ?? createAuthPool();

if (process.env.NODE_ENV !== "production") {
  globalForAuthPostgres.warBrasilAuthPool = authPool;
}
