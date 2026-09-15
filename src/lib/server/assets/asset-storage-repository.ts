import "server-only";

import type { PoolClient } from "pg";
import { pool } from "../db/pool";

type AssetQueryable = Pick<PoolClient, "query">;

export async function isKnownDiceAssetKey(
  objectKey: string,
  db: AssetQueryable = pool,
) {
  const result = await db.query(
    `SELECT 1
       FROM catalog.cosmetics item
      WHERE item.asset_ref=$1
        AND item.slot IN ('dice_attack','dice_defense','dice_neutral')
        AND item.status IN ('announced','available')
      UNION ALL
     SELECT 1
       FROM game.player_cosmetic_loadouts snapshot
      WHERE snapshot.asset_ref=$1
        AND snapshot.slot IN ('dice_attack','dice_defense','dice_neutral')
      LIMIT 1`,
    [objectKey],
  );

  return (result.rowCount ?? 0) > 0;
}
