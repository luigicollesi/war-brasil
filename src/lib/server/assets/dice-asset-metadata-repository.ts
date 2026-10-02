import "server-only";

import type { CosmeticSlot } from "@/src/lib/economy/economy-contract";
import { diceBodyColorForSlot } from "@/src/lib/shared/dice-body-presentation";
import { pool } from "../db/pool";

type DiceBodyPresentationRow = {
  dice_pip_dark: boolean;
};

export async function findDiceBodyColor(
  assetRef: string,
  slot: Extract<
    CosmeticSlot,
    "dice_attack" | "dice_defense" | "dice_neutral"
  >,
): Promise<string> {
  const result = await pool.query<DiceBodyPresentationRow>(
    `SELECT COALESCE(cosmetic_set.dice_pip_dark,FALSE) AS dice_pip_dark
       FROM catalog.cosmetics item
       LEFT JOIN catalog.cosmetic_set_items membership
         ON membership.cosmetic_id=item.id
       LEFT JOIN catalog.cosmetic_sets cosmetic_set
         ON cosmetic_set.id=membership.set_id
      WHERE item.asset_ref=$1
        AND item.slot=$2
      ORDER BY item.is_default ASC,item.id
      LIMIT 1`,
    [assetRef, slot],
  );

  return diceBodyColorForSlot(slot, result.rows[0]?.dice_pip_dark ?? false)!;
}
