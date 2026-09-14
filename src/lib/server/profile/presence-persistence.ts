import "server-only";

import { pool } from "../db/pool";

export async function persistCommanderLastSeen(
  userId: string,
  observedAt: string,
) {
  const parsed = new Date(observedAt);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("Timestamp de presença inválido.");
  }

  await pool.query(
    `UPDATE profile.commanders
        SET last_seen_at=GREATEST(
          COALESCE(last_seen_at,$2::timestamptz),
          $2::timestamptz
        )
      WHERE user_id=$1::uuid`,
    [userId, parsed.toISOString()],
  );
}
