import "server-only";

import type { PoolClient } from "pg";
import { databasePoolStats, pool } from "./db/pool";
import { startGameOperationMetric } from "./observability/game-operation-metrics";

export async function gameQuery<T>(
  execute: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  const finishMetric = startGameOperationMetric("game.query");
  let outcome: "success" | "error" = "error";

  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const value = await execute(client);
    await client.query("COMMIT");
    outcome = "success";
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    finishMetric(outcome, databasePoolStats());
  }
}
