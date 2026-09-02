import "server-only";

import type { PoolClient } from "pg";

export async function withObjectiveSchemaCompatibility<T>(
  _client: PoolClient,
  primary: () => Promise<T>,
  _fallback: () => Promise<T>,
) {
  void _fallback;
  return primary();
}
