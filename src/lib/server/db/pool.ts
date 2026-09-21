import "server-only";

import { Pool, type PoolConfig } from "pg";
import type { DatabasePoolStats } from "../observability/game-operation-metrics";
import { isNeonPooledConnectionString } from "./connection-string";
import { createRuntimePool } from "./runtime-pool";

const globalForPostgres = globalThis as typeof globalThis & {
  postgresPool?: Pool;
};

function databaseConnectionString() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    if (process.env["NEXT_PHASE"] === "phase-production-build") {
      return undefined;
    }

    throw new Error("DATABASE_URL não está configurada.");
  }

  return connectionString;
}

function hyperdriveOriginConnectionString() {
  const connectionString = process.env.DATABASE_HYPERDRIVE_URL?.trim();

  if (!connectionString) {
    return databaseConnectionString();
  }

  if (isNeonPooledConnectionString(connectionString)) {
    throw new Error(
      "DATABASE_HYPERDRIVE_URL deve usar a conexão Neon direta/unpooled (hostname sem -pooler).",
    );
  }

  return connectionString;
}

function createPersistentPool() {
  return new Pool({
    connectionString: databaseConnectionString(),
    max: process.env["NEXT_PHASE"] === "phase-production-build" ? 1 : 10,
  });
}

const persistentPool =
  globalForPostgres.postgresPool ?? createPersistentPool();

export const pool = createRuntimePool({
  label: "database",
  persistentPool,
  workerConfig: (): PoolConfig => ({
    connectionString: hyperdriveOriginConnectionString(),
  }),
  // Production acceleration. The real Cloudflare binding wins when present.
  // Until it is bound, Cloudflare requests prefer DATABASE_HYPERDRIVE_URL
  // (direct/unpooled) and keep DATABASE_URL as the final compatibility fallback.
  hyperdriveBinding: "DATABASE_HYPERDRIVE",
});

export function databasePoolStats(): DatabasePoolStats {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.postgresPool = persistentPool;
}
