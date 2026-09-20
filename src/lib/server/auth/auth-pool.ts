import "server-only";

import { Pool } from "pg";
import { readAuthServerEnvironment } from "./environment";

const globalForAuthPostgres = globalThis as typeof globalThis & {
  warBrasilAuthPool?: Pool;
};

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

function createAuthPool() {
  const { authDatabaseUrl } = readAuthServerEnvironment();

  if (!authDatabaseUrl) {
    if (process.env["NEXT_PHASE"] === "phase-production-build") {
      return new Pool({
        max: 1,
        options: "-c search_path=auth",
      });
    }

    throw new Error(
      "AUTH_DATABASE_URL ou DATABASE_URL não está configurada para autenticação.",
    );
  }

  if (isNeonPooledConnectionString(authDatabaseUrl)) {
    throw new Error(
      "Better Auth usa search_path=auth, que não é aceito no startup packet do Neon PgBouncer. Configure AUTH_DATABASE_URL com a conexão Neon direta/unpooled (hostname sem -pooler) e mantenha DATABASE_URL pooled para o restante da aplicação.",
    );
  }

  return new Pool({
    connectionString: authDatabaseUrl,
    max: 4,
    options: "-c search_path=auth",
  });
}

export const authPool = globalForAuthPostgres.warBrasilAuthPool ?? createAuthPool();

if (process.env.NODE_ENV !== "production") {
  globalForAuthPostgres.warBrasilAuthPool = authPool;
}
