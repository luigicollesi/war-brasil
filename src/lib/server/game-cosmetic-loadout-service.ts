import "server-only";

import type { PoolClient } from "pg";
import { RoomError } from "@/src/lib/server/room-error";

const COSMETIC_SLOTS = [
  "dice_attack",
  "dice_defense",
  "dice_neutral",
  "territory_effect",
] as const;

export type GameCosmeticSlot = (typeof COSMETIC_SLOTS)[number];

type MissingSnapshotRow = {
  player_id: string;
  slot: GameCosmeticSlot;
};

/**
 * Copies each player's current profile loadout into game.* exactly when a match
 * starts. After this function succeeds, runtime reads no longer need profile,
 * inventory, or mutable catalog rows for cosmetic presentation.
 */
export async function capturePlayerCosmeticLoadouts(
  client: PoolClient,
  roomId: string,
) {
  await client.query(
    `WITH defaults AS (
       SELECT id, slot, asset_ref, effect_key
         FROM catalog.cosmetics
        WHERE is_default=TRUE
     ),
     resolved AS (
       SELECT player.id AS player_id,
              defaults.slot,
              COALESCE(equipped.id, defaults.id) AS cosmetic_id,
              COALESCE(equipped.asset_ref, defaults.asset_ref) AS asset_ref,
              COALESCE(equipped.effect_key, defaults.effect_key) AS effect_key
         FROM game.players player
         CROSS JOIN defaults
         LEFT JOIN profile.cosmetic_loadout loadout
           ON loadout.user_id=player.user_id
          AND loadout.slot=defaults.slot
         LEFT JOIN catalog.cosmetics equipped
           ON equipped.id=loadout.cosmetic_id
          AND equipped.slot=loadout.slot
        WHERE player.room_id=$1
     )
     INSERT INTO game.player_cosmetic_loadouts(
       player_id,slot,cosmetic_id,asset_ref,effect_key,captured_at
     )
     SELECT player_id,slot,cosmetic_id,asset_ref,effect_key,NOW()
       FROM resolved
     ON CONFLICT (player_id,slot) DO UPDATE
     SET cosmetic_id=EXCLUDED.cosmetic_id,
         asset_ref=EXCLUDED.asset_ref,
         effect_key=EXCLUDED.effect_key,
         captured_at=EXCLUDED.captured_at`,
    [roomId],
  );

  const missing = (
    await client.query<MissingSnapshotRow>(
      `WITH slots(slot) AS (
         VALUES
           ('dice_attack'::varchar),
           ('dice_defense'::varchar),
           ('dice_neutral'::varchar),
           ('territory_effect'::varchar)
       )
       SELECT player.id AS player_id, slots.slot
         FROM game.players player
         CROSS JOIN slots
         LEFT JOIN game.player_cosmetic_loadouts snapshot
           ON snapshot.player_id=player.id
          AND snapshot.slot=slots.slot
        WHERE player.room_id=$1
          AND snapshot.player_id IS NULL
        ORDER BY player.id,slots.slot
        LIMIT 1`,
      [roomId],
    )
  ).rows[0];

  if (missing) {
    throw new RoomError(
      `O loadout cosmético da partida está incompleto para o jogador ${missing.player_id} (${missing.slot}).`,
      503,
    );
  }
}
