import "server-only";

import { Pool } from "pg";
import type { DatabasePoolStats } from "../observability/game-operation-metrics";

const globalForPostgres = globalThis as typeof globalThis & {
  postgresPool?: Pool;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL não está configurada.");
  }

  return new Pool({
    connectionString,
    max: 10,
  });
}

export const pool = globalForPostgres.postgresPool ?? createPool();

export function databasePoolStats(): DatabasePoolStats {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.postgresPool = pool;
}
