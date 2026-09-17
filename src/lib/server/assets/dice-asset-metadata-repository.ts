import "server-only";

import type { CosmeticSlot } from "@/src/lib/economy/economy-contract";
import { pool } from "../db/pool";

type DiceBodyColorRow = {
  body_color: string | null;
};

export async function findDiceBodyColor(
  assetRef: string,
  slot: Extract<
    CosmeticSlot,
    "dice_attack" | "dice_defense" | "dice_neutral"
  >,
): Promise<string | null> {
  const result = await pool.query<DiceBodyColorRow>(
    `SELECT body_color
       FROM catalog.cosmetics
      WHERE asset_ref=$1
        AND slot=$2
      ORDER BY is_default ASC, id
      LIMIT 1`,
    [assetRef, slot],
  );

  return result.rows[0]?.body_color ?? null;
}
