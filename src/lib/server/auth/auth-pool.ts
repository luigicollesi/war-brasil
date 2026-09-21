import "server-only";

import { Pool, type PoolConfig } from "pg";
import { isNeonPooledConnectionString } from "../db/connection-string";
import { createRuntimePool } from "../db/runtime-pool";
import { readAuthServerEnvironment } from "./environment";

const globalForAuthPostgres = globalThis as typeof globalThis & {
  warBrasilAuthPool?: Pool;
};

function authConnectionString() {
  const { authDatabaseUrl } = readAuthServerEnvironment();

  if (!authDatabaseUrl) {
    if (process.env["NEXT_PHASE"] === "phase-production-build") {
      return undefined;
    }

    throw new Error(
      "AUTH_DATABASE_URL, DATABASE_HYPERDRIVE_URL ou DATABASE_URL não está configurada para autenticação.",
    );
  }

  if (isNeonPooledConnectionString(authDatabaseUrl)) {
    throw new Error(
      "Better Auth usa search_path=auth, que não é aceito no startup packet do Neon PgBouncer. Configure AUTH_DATABASE_URL com a conexão Neon direta/unpooled (hostname sem -pooler) e mantenha DATABASE_URL pooled para o restante da aplicação.",
    );
  }

  return authDatabaseUrl;
}

function authPoolConfig(max: number): PoolConfig {
  return {
    connectionString: authConnectionString(),
    max,
    options: "-c search_path=auth",
  };
}

function createPersistentAuthPool() {
  return new Pool(
    authPoolConfig(
      process.env["NEXT_PHASE"] === "phase-production-build" ? 1 : 4,
    ),
  );
}

const persistentAuthPool =
  globalForAuthPostgres.warBrasilAuthPool ?? createPersistentAuthPool();

export const authPool = createRuntimePool({
  label: "auth database",
  persistentPool: persistentAuthPool,
  workerConfig: () => authPoolConfig(2),
});

if (process.env.NODE_ENV !== "production") {
  globalForAuthPostgres.warBrasilAuthPool = persistentAuthPool;
}
