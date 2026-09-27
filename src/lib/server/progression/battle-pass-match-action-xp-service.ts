import "server-only";

import type { PoolClient } from "pg";
import {
  parseBattlePassXpProfile,
  scaleBattlePassXp,
} from "@/src/lib/shared/progression/battle-pass-xp";
import type {
  BattlePassGameXpEvent,
  BattlePassGameXpEventIntensity,
  BattlePassGameXpEventKind,
} from "@/src/lib/shared/progression/battle-pass-game-xp-event";
import type { BattlePassMatchSnapshot } from "./battle-pass-match-xp-service";

type ProgressRow = {
  match_id: string;
  season_id: string;
  user_id: string;
  player_id_snapshot: string;
  multiplier_bps: number;
  raw_action_xp: string;
  scaled_action_xp: string;
  troops_placed: number;
  card_sets_redeemed: number;
  troops_lost_dice: number;
  enemy_troops_defeated_dice: number;
  settled_at: Date | null;
  battle_pass_xp_profile_snapshot: unknown;
};

export type BattlePassActionXpResult = Readonly<{
  playerId: string;
  userId: string;
  matchId: string;
  seasonId: string;
  rawXp: number;
  xpAwarded: number;
  duplicate: boolean;
  event: BattlePassGameXpEvent | null;
}>;

function nonNegativeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid Battle Pass ${label}.`);
  }
  return value;
}

function cappedRawXp(
  previousUnits: number,
  addedUnits: number,
  xpPerUnit: number,
  capXp: number,
) {
  const previous = Math.min(previousUnits * xpPerUnit, capXp);
  const next = Math.min((previousUnits + addedUnits) * xpPerUnit, capXp);
  return Math.max(0, next - previous);
}

function presentationEvent(input: Readonly<{
  row: ProgressRow;
  sourceKey: string;
  kind: BattlePassGameXpEventKind;
  xp: number;
  label: string;
  detail?: string | null;
  intensity: BattlePassGameXpEventIntensity;
}>) {
  if (input.xp <= 0) return null;
  return {
    id: `${input.row.match_id}:${input.row.user_id}:${input.sourceKey}`,
    matchId: input.row.match_id,
    sourceKey: input.sourceKey,
    kind: input.kind,
    xp: input.xp,
    label: input.label,
    detail: input.detail ?? null,
    intensity: input.intensity,
    occurredAt: new Date().toISOString(),
  } satisfies BattlePassGameXpEvent;
}

async function lockProgressForPlayer(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  const row = (
    await client.query<ProgressRow>(
      `SELECT progress.match_id::text,
              progress.season_id,
              progress.user_id::text,
              progress.player_id_snapshot::text,
              progress.multiplier_bps,
              progress.raw_action_xp::text,
              progress.scaled_action_xp::text,
              progress.troops_placed,
              progress.card_sets_redeemed,
              progress.troops_lost_dice,
              progress.enemy_troops_defeated_dice,
              progress.settled_at,
              match.battle_pass_xp_profile_snapshot
         FROM game.rooms room
         JOIN progression.battle_pass_match_progress progress
           ON progress.match_id=room.current_match_id
          AND progress.player_id_snapshot=$2::bigint
         JOIN game.matches match ON match.id=progress.match_id
        WHERE room.id=$1
        FOR UPDATE OF progress`,
      [roomId, playerId],
    )
  ).rows[0];

  if (!row || row.settled_at) return null;
  const profile = parseBattlePassXpProfile(
    row.battle_pass_xp_profile_snapshot,
  );
  if (profile.actionModelVersion < 2) return null;
  return { row, profile };
}

async function existingAction(
  client: PoolClient,
  row: ProgressRow,
  sourceKey: string,
) {
  return (
    await client.query<{ awarded_xp: string }>(
      `SELECT awarded_xp::text
         FROM progression.battle_pass_match_xp_actions
        WHERE match_id=$1
          AND user_id=$2::uuid
          AND source_key=$3`,
      [row.match_id, row.user_id, sourceKey],
    )
  ).rows[0];
}

async function insertAction(
  client: PoolClient,
  input: Readonly<{
    row: ProgressRow;
    sourceKey: string;
    actionKind:
      | "troops_placed"
      | "card_trade"
      | "combat"
      | "territory_conquest";
    units: number;
    rawXp: number;
    awardedXp: number;
    metadata: Record<string, unknown>;
  }>,
) {
  const inserted = await client.query(
    `INSERT INTO progression.battle_pass_match_xp_actions(
       match_id,season_id,user_id,source_key,action_kind,units,
       raw_xp,awarded_xp,metadata
     )
     VALUES($1,$2,$3::uuid,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (match_id,user_id,source_key) DO NOTHING`,
    [
      input.row.match_id,
      input.row.season_id,
      input.row.user_id,
      input.sourceKey,
      input.actionKind,
      input.units,
      input.rawXp,
      input.awardedXp,
      JSON.stringify(input.metadata),
    ],
  );
  return (inserted.rowCount ?? 0) === 1;
}

async function updateProgress(
  client: PoolClient,
  row: ProgressRow,
  input: Readonly<{
    rawXp: number;
    nextScaledXp: number;
    troopsPlaced?: number;
    cardSetsRedeemed?: number;
    troopsLostDice?: number;
    enemyTroopsDefeatedDice?: number;
  }>,
) {
  await client.query(
    `UPDATE progression.battle_pass_match_progress
        SET raw_action_xp=raw_action_xp+$3,
            scaled_action_xp=$4,
            troops_placed=COALESCE($5,troops_placed),
            card_sets_redeemed=COALESCE($6,card_sets_redeemed),
            troops_lost_dice=COALESCE($7,troops_lost_dice),
            enemy_troops_defeated_dice=COALESCE($8,enemy_troops_defeated_dice),
            updated_at=NOW()
      WHERE match_id=$1 AND user_id=$2::uuid`,
    [
      row.match_id,
      row.user_id,
      input.rawXp,
      input.nextScaledXp,
      input.troopsPlaced ?? null,
      input.cardSetsRedeemed ?? null,
      input.troopsLostDice ?? null,
      input.enemyTroopsDefeatedDice ?? null,
    ],
  );
}

function baseResult(
  row: ProgressRow,
  playerId: string,
  rawXp: number,
  xpAwarded: number,
  duplicate: boolean,
  event: BattlePassGameXpEvent | null,
): BattlePassActionXpResult {
  return {
    playerId,
    userId: row.user_id,
    matchId: row.match_id,
    seasonId: row.season_id,
    rawXp,
    xpAwarded,
    duplicate,
    event,
  };
}

async function duplicateResult(
  row: ProgressRow,
  playerId: string,
): Promise<BattlePassActionXpResult> {
  return baseResult(row, playerId, 0, 0, true, null);
}

export async function initializeBattlePassMatchProgress(
  client: PoolClient,
  roomId: string,
  matchId: string,
  snapshot: BattlePassMatchSnapshot | null,
) {
  if (!snapshot || snapshot.profile.actionModelVersion < 2) return;

  const humanCount =
    (
      await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM game.players
          WHERE room_id=$1 AND is_bot=FALSE`,
        [roomId],
      )
    ).rows[0]?.count ?? 0;
  const multiplierBps =
    humanCount === 1
      ? snapshot.profile.soloHumanBotMultiplierBps
      : 10_000;

  await client.query(
    `INSERT INTO progression.battle_pass_match_progress(
       match_id,season_id,user_id,player_id_snapshot,multiplier_bps
     )
     SELECT $1::bigint,$2,player.user_id,player.id,$3
       FROM game.players player
      WHERE player.room_id=$4
        AND player.is_bot=FALSE
        AND player.user_id IS NOT NULL
     ON CONFLICT (match_id,user_id) DO NOTHING`,
    [matchId, snapshot.seasonId, multiplierBps, roomId],
  );
}

export async function recordBattlePassTroopsPlaced(
  client: PoolClient,
  input: Readonly<{
    roomId: string;
    playerId: string;
    sourceKey: string | null | undefined;
    troops: number;
  }>,
): Promise<BattlePassActionXpResult | null> {
  if (!input.sourceKey) return null;
  const troops = nonNegativeInteger(input.troops, "troops placed");
  if (troops <= 0) return null;
  const context = await lockProgressForPlayer(
    client,
    input.roomId,
    input.playerId,
  );
  if (!context) return null;
  const { row, profile } = context;
  if (await existingAction(client, row, input.sourceKey)) {
    return duplicateResult(row, input.playerId);
  }

  const rawXp = cappedRawXp(
    row.troops_placed,
    troops,
    profile.troopPlacedXp,
    profile.troopPlacedCapXp,
  );
  const nextRaw = Number(row.raw_action_xp) + rawXp;
  const nextScaledXp = scaleBattlePassXp(nextRaw, row.multiplier_bps);
  const xpAwarded = nextScaledXp - Number(row.scaled_action_xp);
  const inserted = await insertAction(client, {
    row,
    sourceKey: input.sourceKey,
    actionKind: "troops_placed",
    units: troops,
    rawXp,
    awardedXp: xpAwarded,
    metadata: { troops },
  });
  if (!inserted) return duplicateResult(row, input.playerId);

  await updateProgress(client, row, {
    rawXp,
    nextScaledXp,
    troopsPlaced: row.troops_placed + troops,
  });

  return baseResult(
    row,
    input.playerId,
    rawXp,
    xpAwarded,
    false,
    presentationEvent({
      row,
      sourceKey: input.sourceKey,
      kind: "troops_placed",
      xp: xpAwarded,
      label: "REFORÇOS POSICIONADOS",
      intensity: "micro",
    }),
  );
}

export async function recordBattlePassCardTrade(
  client: PoolClient,
  input: Readonly<{
    roomId: string;
    playerId: string;
    sourceKey: string | null | undefined;
  }>,
): Promise<BattlePassActionXpResult | null> {
  if (!input.sourceKey) return null;
  const context = await lockProgressForPlayer(
    client,
    input.roomId,
    input.playerId,
  );
  if (!context) return null;
  const { row, profile } = context;
  if (await existingAction(client, row, input.sourceKey)) {
    return duplicateResult(row, input.playerId);
  }

  const rawXp = cappedRawXp(
    row.card_sets_redeemed,
    1,
    profile.cardTradeXp,
    profile.cardTradeCapXp,
  );
  const nextRaw = Number(row.raw_action_xp) + rawXp;
  const nextScaledXp = scaleBattlePassXp(nextRaw, row.multiplier_bps);
  const xpAwarded = nextScaledXp - Number(row.scaled_action_xp);
  const inserted = await insertAction(client, {
    row,
    sourceKey: input.sourceKey,
    actionKind: "card_trade",
    units: 1,
    rawXp,
    awardedXp: xpAwarded,
    metadata: { cardCount: 3 },
  });
  if (!inserted) return duplicateResult(row, input.playerId);

  await updateProgress(client, row, {
    rawXp,
    nextScaledXp,
    cardSetsRedeemed: row.card_sets_redeemed + 1,
  });

  return baseResult(
    row,
    input.playerId,
    rawXp,
    xpAwarded,
    false,
    presentationEvent({
      row,
      sourceKey: input.sourceKey,
      kind: "card_trade",
      xp: xpAwarded,
      label: "TROCA DE CARTAS",
      intensity: "standard",
    }),
  );
}

function combatDetail(defeated: number, lost: number) {
  const defeatedText =
    defeated === 1 ? "1 tropa derrotada" : `${defeated} tropas derrotadas`;
  const lostText = lost === 1 ? "1 perdida" : `${lost} perdidas`;
  return `${defeatedText} · ${lostText}`;
}

async function recordCombatForPlayer(
  client: PoolClient,
  input: Readonly<{
    roomId: string;
    playerId: string;
    sourceKey: string;
    troopsLost: number;
    enemyTroopsDefeated: number;
  }>,
): Promise<BattlePassActionXpResult | null> {
  const troopsLost = nonNegativeInteger(input.troopsLost, "combat losses");
  const enemyTroopsDefeated = nonNegativeInteger(
    input.enemyTroopsDefeated,
    "enemy troops defeated",
  );
  const context = await lockProgressForPlayer(
    client,
    input.roomId,
    input.playerId,
  );
  if (!context) return null;
  const { row, profile } = context;
  if (await existingAction(client, row, input.sourceKey)) {
    return duplicateResult(row, input.playerId);
  }

  const lostRawXp = cappedRawXp(
    row.troops_lost_dice,
    troopsLost,
    profile.troopLostDiceXp,
    profile.troopLostDiceCapXp,
  );
  const defeatedRawXp = cappedRawXp(
    row.enemy_troops_defeated_dice,
    enemyTroopsDefeated,
    profile.enemyTroopDefeatedXp,
    profile.enemyTroopDefeatedCapXp,
  );
  const rawXp = lostRawXp + defeatedRawXp;
  const nextRaw = Number(row.raw_action_xp) + rawXp;
  const nextScaledXp = scaleBattlePassXp(nextRaw, row.multiplier_bps);
  const xpAwarded = nextScaledXp - Number(row.scaled_action_xp);
  const inserted = await insertAction(client, {
    row,
    sourceKey: input.sourceKey,
    actionKind: "combat",
    units: troopsLost + enemyTroopsDefeated,
    rawXp,
    awardedXp: xpAwarded,
    metadata: {
      troopsLost,
      enemyTroopsDefeated,
      troopLostRawXp: lostRawXp,
      enemyDefeatedRawXp: defeatedRawXp,
    },
  });
  if (!inserted) return duplicateResult(row, input.playerId);

  await updateProgress(client, row, {
    rawXp,
    nextScaledXp,
    troopsLostDice: row.troops_lost_dice + troopsLost,
    enemyTroopsDefeatedDice:
      row.enemy_troops_defeated_dice + enemyTroopsDefeated,
  });

  return baseResult(
    row,
    input.playerId,
    rawXp,
    xpAwarded,
    false,
    presentationEvent({
      row,
      sourceKey: input.sourceKey,
      kind: "combat",
      xp: xpAwarded,
      label: "CONFRONTO",
      detail: combatDetail(enemyTroopsDefeated, troopsLost),
      intensity: "standard",
    }),
  );
}

export async function recordBattlePassCombat(
  client: PoolClient,
  input: Readonly<{
    roomId: string;
    sourceKey: string | null | undefined;
    attackerPlayerId: string;
    defenderPlayerId: string;
    attackerLosses: number;
    defenderLosses: number;
  }>,
) {
  if (!input.sourceKey) return [];
  const sourceKey = `${input.sourceKey}:combat`;
  const attacker = await recordCombatForPlayer(client, {
    roomId: input.roomId,
    playerId: input.attackerPlayerId,
    sourceKey,
    troopsLost: input.attackerLosses,
    enemyTroopsDefeated: input.defenderLosses,
  });
  const defender = await recordCombatForPlayer(client, {
    roomId: input.roomId,
    playerId: input.defenderPlayerId,
    sourceKey,
    troopsLost: input.defenderLosses,
    enemyTroopsDefeated: input.attackerLosses,
  });
  return [attacker, defender].filter(
    (result): result is BattlePassActionXpResult => result !== null,
  );
}

export async function recordBattlePassTerritoryConquest(
  client: PoolClient,
  input: Readonly<{
    roomId: string;
    playerId: string;
    territoryId: number;
    sourceKey: string | null | undefined;
  }>,
): Promise<BattlePassActionXpResult | null> {
  if (!input.sourceKey) return null;
  const territoryId = nonNegativeInteger(input.territoryId, "territory id");
  if (territoryId < 1 || territoryId > 42) {
    throw new Error("Invalid Battle Pass territory id.");
  }

  const sourceKey = `${input.sourceKey}:territory`;
  const context = await lockProgressForPlayer(
    client,
    input.roomId,
    input.playerId,
  );
  if (!context) return null;
  const { row, profile } = context;
  if (await existingAction(client, row, sourceKey)) {
    return duplicateResult(row, input.playerId);
  }

  const conquest = (
    await client.query<{ conquest_count: number }>(
      `SELECT conquest_count
         FROM progression.battle_pass_match_territory_conquests
        WHERE match_id=$1
          AND user_id=$2::uuid
          AND territory_id=$3
        FOR UPDATE`,
      [row.match_id, row.user_id, territoryId],
    )
  ).rows[0];
  const previousCount = conquest?.conquest_count ?? 0;
  const rawXp =
    previousCount === 0
      ? profile.territoryFirstConquestXp
      : previousCount === 1
        ? profile.territorySecondConquestXp
        : 0;
  const nextRaw = Number(row.raw_action_xp) + rawXp;
  const nextScaledXp = scaleBattlePassXp(nextRaw, row.multiplier_bps);
  const xpAwarded = nextScaledXp - Number(row.scaled_action_xp);

  const inserted = await insertAction(client, {
    row,
    sourceKey,
    actionKind: "territory_conquest",
    units: 1,
    rawXp,
    awardedXp: xpAwarded,
    metadata: {
      territoryId,
      conquestNumber: previousCount + 1,
    },
  });
  if (!inserted) return duplicateResult(row, input.playerId);

  await client.query(
    `INSERT INTO progression.battle_pass_match_territory_conquests(
       match_id,user_id,territory_id,conquest_count
     )
     VALUES($1,$2::uuid,$3,1)
     ON CONFLICT (match_id,user_id,territory_id) DO UPDATE
     SET conquest_count=
           progression.battle_pass_match_territory_conquests.conquest_count+1,
         updated_at=NOW()`,
    [row.match_id, row.user_id, territoryId],
  );
  await updateProgress(client, row, {
    rawXp,
    nextScaledXp,
  });

  const conquestNumber = previousCount + 1;
  const kind =
    conquestNumber === 1 ? "territory_conquered" : "territory_reconquered";
  const label =
    conquestNumber === 1 ? "TERRITÓRIO DOMINADO" : "RECONQUISTA";

  return baseResult(
    row,
    input.playerId,
    rawXp,
    xpAwarded,
    false,
    presentationEvent({
      row,
      sourceKey,
      kind,
      xp: xpAwarded,
      label,
      intensity: "major",
    }),
  );
}
