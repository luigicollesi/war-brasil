import "server-only";

import { Pool, type PoolConfig } from "pg";
import type { DatabasePoolStats } from "../observability/game-operation-metrics";
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
    connectionString: databaseConnectionString(),
  }),
  // Optional production acceleration. When a DATABASE_HYPERDRIVE binding is
  // present, Cloudflare requests use it transparently; otherwise DATABASE_URL
  // remains the request-scoped fallback.
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
