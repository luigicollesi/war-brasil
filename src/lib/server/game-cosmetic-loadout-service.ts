import "server-only";

import type { PoolClient } from "pg";
import {
  territorySkinRuntimeEffectKey,
  territorySkinSnapshot,
} from "@/src/lib/economy/territory-skin-contract";
import type {
  GameCosmeticSelection,
  GamePlayerCosmetics,
} from "@/src/lib/game-contract";
import {
  diceAssetDeliveryPath,
  territorySkinAssetDeliveryPath,
} from "@/src/lib/server/assets/asset-storage-service";
import { RoomError } from "@/src/lib/server/room-error";

export type GameCosmeticSlot =
  | "dice_attack"
  | "dice_defense"
  | "dice_neutral"
  | "territory_skin";

type MissingSnapshotRow = {
  player_id: string;
  slot: GameCosmeticSlot;
};

type GameCosmeticSnapshotRow = {
  player_id: string;
  slot: GameCosmeticSlot;
  cosmetic_id: string;
  asset_ref: string | null;
  effect_key: string | null;
  body_color: string | null;
  body_highlight_color: string | null;
};

type GamePlayerSnapshotStateRow = {
  id: string;
  room_status: "waiting" | "order_roll" | "playing" | "finished";
};

function projectedSnapshotAssetRef(row: GameCosmeticSnapshotRow) {
  if (!row.asset_ref) return null;
  if (
    row.slot !== "territory_skin" &&
    row.asset_ref.startsWith("cosmetics/dice/")
  ) {
    return diceAssetDeliveryPath(row.asset_ref);
  }
  return row.asset_ref;
}

function selection(row: GameCosmeticSnapshotRow): GameCosmeticSelection {
  return {
    cosmeticId: row.cosmetic_id,
    assetRef: projectedSnapshotAssetRef(row),
    effectKey: row.effect_key,
    bodyColor: row.body_color,
    bodyHighlightColor: row.body_highlight_color,
  };
}

function territorySelection(row: GameCosmeticSnapshotRow): GameCosmeticSelection {
  const snapshot = territorySkinSnapshot({
    cosmeticId: row.cosmetic_id,
    assetRef: row.asset_ref,
    effectKey: row.effect_key,
  });

  return {
    cosmeticId: snapshot.cosmeticId,
    assetRef:
      snapshot.kind === "image"
        ? territorySkinAssetDeliveryPath(snapshot.assetRef)
        : null,
    effectKey: territorySkinRuntimeEffectKey(snapshot),
    bodyColor: null,
    bodyHighlightColor: null,
  };
}

function defaultPlayerCosmetics(): GamePlayerCosmetics {
  return {
    diceAttack: {
      cosmeticId: "dice.attack.default",
      assetRef: null,
      effectKey: null,
      bodyColor: null,
      bodyHighlightColor: null,
    },
    diceDefense: {
      cosmeticId: "dice.defense.default",
      assetRef: null,
      effectKey: null,
      bodyColor: null,
      bodyHighlightColor: null,
    },
    diceNeutral: {
      cosmeticId: "dice.neutral.default",
      assetRef: null,
      effectKey: null,
      bodyColor: null,
      bodyHighlightColor: null,
    },
    territoryEffect: {
      cosmeticId: "territory.effect.default",
      assetRef: null,
      effectKey: "default",
      bodyColor: null,
      bodyHighlightColor: null,
    },
  };
}

function waitingPlayerCosmetics(
  bySlot: Partial<Record<GameCosmeticSlot, GameCosmeticSnapshotRow>>,
): GamePlayerCosmetics {
  const defaults = defaultPlayerCosmetics();

  return {
    diceAttack: bySlot.dice_attack
      ? selection(bySlot.dice_attack)
      : defaults.diceAttack,
    diceDefense: bySlot.dice_defense
      ? selection(bySlot.dice_defense)
      : defaults.diceDefense,
    diceNeutral: bySlot.dice_neutral
      ? selection(bySlot.dice_neutral)
      : defaults.diceNeutral,
    territoryEffect: bySlot.territory_skin
      ? territorySelection(bySlot.territory_skin)
      : defaults.territoryEffect,
  };
}

function requirePlayerCosmetics(
  playerId: string,
  bySlot: Partial<Record<GameCosmeticSlot, GameCosmeticSnapshotRow>>,
): GamePlayerCosmetics {
  const attack = bySlot.dice_attack;
  const defense = bySlot.dice_defense;
  const neutral = bySlot.dice_neutral;
  const territory = bySlot.territory_skin;

  if (!attack || !defense || !neutral || !territory) {
    throw new RoomError(
      `O snapshot cosmético da partida está incompleto para o jogador ${playerId}.`,
      503,
    );
  }

  return {
    diceAttack: selection(attack),
    diceDefense: selection(defense),
    diceNeutral: selection(neutral),
    territoryEffect: territorySelection(territory),
  };
}

/**
 * Match start and profile equip mutations use profile.commanders as the same
 * per-user transaction mutex. Rows are locked in UUID order so a room with
 * several humans cannot deadlock another match-start path that touches the same
 * commanders. Once these locks are held, the following statement sees either
 * the complete loadout before an equip or the complete loadout after it.
 */
async function lockRoomCommanderCosmeticStates(
  client: PoolClient,
  roomId: string,
) {
  await client.query(
    `SELECT commander.user_id
       FROM profile.commanders commander
       JOIN game.players player ON player.user_id=commander.user_id
      WHERE player.room_id=$1
        AND player.user_id IS NOT NULL
      ORDER BY commander.user_id
      FOR UPDATE OF commander`,
    [roomId],
  );
}

/**
 * Copies each player's current profile loadout into game.* exactly when a match
 * starts. After this function succeeds, runtime reads no longer need profile,
 * inventory, or mutable catalog rows for cosmetic presentation. Asset and body
 * colors are frozen here; delivery URLs are projected only while building DTOs.
 */
export async function capturePlayerCosmeticLoadouts(
  client: PoolClient,
  roomId: string,
) {
  await lockRoomCommanderCosmeticStates(client, roomId);

  await client.query(
    `WITH defaults AS (
       SELECT id, slot, asset_ref, effect_key, body_color, body_highlight_color
         FROM catalog.cosmetics
        WHERE is_default=TRUE
          AND slot IN ('dice_attack','dice_defense','dice_neutral','territory_skin')
     ),
     resolved AS (
       SELECT player.id AS player_id,
              defaults.slot,
              COALESCE(equipped.id, defaults.id) AS cosmetic_id,
              CASE
                WHEN equipped.id IS NOT NULL THEN equipped.asset_ref
                ELSE defaults.asset_ref
              END AS asset_ref,
              CASE
                WHEN equipped.id IS NOT NULL THEN equipped.effect_key
                ELSE defaults.effect_key
              END AS effect_key,
              CASE
                WHEN equipped.id IS NOT NULL THEN equipped.body_color
                ELSE defaults.body_color
              END AS body_color,
              CASE
                WHEN equipped.id IS NOT NULL THEN equipped.body_highlight_color
                ELSE defaults.body_highlight_color
              END AS body_highlight_color
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
       player_id,slot,cosmetic_id,asset_ref,effect_key,
       body_color,body_highlight_color,captured_at
     )
     SELECT player_id,slot,cosmetic_id,asset_ref,effect_key,
            body_color,body_highlight_color,NOW()
       FROM resolved
     ON CONFLICT (player_id,slot) DO UPDATE
     SET cosmetic_id=EXCLUDED.cosmetic_id,
         asset_ref=EXCLUDED.asset_ref,
         effect_key=EXCLUDED.effect_key,
         body_color=EXCLUDED.body_color,
         body_highlight_color=EXCLUDED.body_highlight_color,
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
           ('territory_skin'::varchar)
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

/**
 * Reads only the frozen game snapshot. This function deliberately does not join
 * profile.*, inventory.*, or catalog.* so a running match cannot drift when a
 * commander changes loadout or when storefront metadata changes.
 *
 * Waiting rooms may contain legacy/transitional partial rows. They are not an
 * authoritative match snapshot yet, so each absent slot resolves to the visual
 * default in memory. Once the room leaves waiting, all four persisted rows are
 * mandatory and an incomplete snapshot remains a hard failure.
 */
export async function loadRoomPlayerCosmetics(
  client: PoolClient,
  roomId: string,
): Promise<Map<string, GamePlayerCosmetics>> {
  const playerStates = (
    await client.query<GamePlayerSnapshotStateRow>(
      `SELECT player.id, room.status AS room_status
         FROM game.players player
         JOIN game.rooms room ON room.id=player.room_id
        WHERE player.room_id=$1
        ORDER BY player.joined_at,player.id`,
      [roomId],
    )
  ).rows;

  const rows = (
    await client.query<GameCosmeticSnapshotRow>(
      `SELECT snapshot.player_id,
              snapshot.slot,
              snapshot.cosmetic_id,
              snapshot.asset_ref,
              snapshot.effect_key,
              snapshot.body_color,
              snapshot.body_highlight_color
         FROM game.player_cosmetic_loadouts snapshot
         JOIN game.players player ON player.id=snapshot.player_id
        WHERE player.room_id=$1
        ORDER BY snapshot.player_id,snapshot.slot`,
      [roomId],
    )
  ).rows;

  const grouped = new Map<
    string,
    Partial<Record<GameCosmeticSlot, GameCosmeticSnapshotRow>>
  >();

  for (const row of rows) {
    const current = grouped.get(row.player_id) ?? {};
    current[row.slot] = row;
    grouped.set(row.player_id, current);
  }

  const result = new Map<string, GamePlayerCosmetics>();
  for (const player of playerStates) {
    const playerRows = grouped.get(player.id) ?? {};
    if (player.room_status === "waiting") {
      result.set(player.id, waitingPlayerCosmetics(playerRows));
      continue;
    }

    result.set(player.id, requirePlayerCosmetics(player.id, playerRows));
  }

  return result;
}
