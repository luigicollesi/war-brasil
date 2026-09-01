import "server-only";

import type { PoolClient } from "pg";

function isSchemaCompatibilityError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  // PostgreSQL: undefined_table / undefined_column.
  return error.code === "42P01" || error.code === "42703";
}

export async function withObjectiveSchemaCompatibility<T>(
  client: PoolClient,
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
) {
  await client.query("SAVEPOINT objective_rules_compatibility");

  try {
    const result = await primary();
    await client.query("RELEASE SAVEPOINT objective_rules_compatibility");
    return result;
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT objective_rules_compatibility");
    await client.query("RELEASE SAVEPOINT objective_rules_compatibility");

    if (!isSchemaCompatibilityError(error)) throw error;
    return fallback();
  }
}
