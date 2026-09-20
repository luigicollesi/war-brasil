import { noStoreJson } from "@/src/lib/api-response";
import { pool } from "@/src/lib/db/pool";
import { authPool } from "@/src/lib/server/auth/auth-pool";

export async function GET() {
  try {
    const [, authSchema] = await Promise.all([
      pool.query("SELECT 1"),
      authPool.query<{ schema_name: string }>(
        "SELECT current_schema() AS schema_name",
      ),
    ]);

    if (authSchema.rows[0]?.schema_name !== "auth") {
      throw new Error("Auth database search_path não resolveu o schema auth.");
    }

    return noStoreJson({ ok: true });
  } catch (error) {
    console.error("[war-brasil] health check indisponível", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return noStoreJson({ ok: false }, { status: 503 });
  }
}
