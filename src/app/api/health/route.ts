import { noStoreJson } from "@/src/lib/api-response";
import { pool } from "@/src/lib/db/pool";

export async function GET() {
  try {
    await pool.query("SELECT 1");
    return noStoreJson({ ok: true });
  } catch (error) {
    console.error("[war-brasil] health check indisponível", error);
    return noStoreJson({ ok: false }, { status: 503 });
  }
}
