import "server-only";

import type { PoolClient } from "pg";
import {
  calculateBattlePassMatchXp,
  parseBattlePassXpProfile,
  resolveBattlePassLevel,
  scaleBattlePassXp,
} from "@/src/lib/shared/progression/battle-pass-xp";
import type {
  BattlePassLevelThreshold,
  BattlePassXpProfile,
} from "@/src/lib/shared/progression/battle-pass-contract";
import type { BattlePassGameXpEvent } from "@/src/lib/shared/progression/battle-pass-game-xp-event";

type ActiveSeasonRow = {
  season_id: string;
  profile_id: string;
  action_model_version: number;
  troop_placed_xp: number;
  troop_placed_cap_xp: number;
  card_trade_xp: number;
  card_trade_cap_xp: number;
  troop_lost_dice_xp: number;
  troop_lost_dice_cap_xp: number;
  enemy_troop_defeated_xp: number;
  enemy_troop_defeated_cap_xp: number;
  territory_first_conquest_xp: number;
  territory_second_conquest_xp: number;
  completion_xp: number;
  victory_bonus_xp: number;
  solo_human_bot_multiplier_bps: number;
};

type MatchProgressionRow = {
  battle_pass_season_id: string | null;
  battle_pass_xp_profile_id: string | null;
  battle_pass_xp_profile_snapshot: unknown;
};

type ParticipantRow = {
  user_id: string | null;
  player_id_snapshot: string;
  is_bot: boolean;
  is_winner: boolean | null;
  left_at_snapshot: string | null;
};

type AccumulatedProgressRow = {
  match_id: string;
  season_id: string;
  user_id: string;
  player_id_snapshot: string;
  multiplier_bps: number;
  raw_action_xp: string;
  scaled_action_xp: string;
  settled_at: Date | null;
  settled_reason: "match_completed" | "player_left" | null;
  settled_xp: string | null;
};

export type BattlePassMatchSnapshot = Readonly<{
  seasonId: string;
  profileId: string;
  profile: BattlePassXpProfile;
}>;

export type BattlePassXpAward = Readonly<{
  userId: string;
  seasonId: string;
  matchId: string;
  xpGranted: number;
  levelReached: number;
  duplicate: boolean;
  actionXp?: number;
  completionXp?: number;
  victoryBonusXp?: number;
  settledReason?: "match_completed" | "player_left";
}>;

export function battlePassSettlementPresentationEvent(
  award: BattlePassXpAward | null,
): BattlePassGameXpEvent | null {
  if (!award || award.duplicate || award.xpGranted <= 0) return null;

  const actionXp = award.actionXp ?? 0;
  const completionXp = award.completionXp ?? 0;
  const victoryBonusXp = award.victoryBonusXp ?? 0;
  const occurredAt = new Date().toISOString();

  if (award.settledReason === "player_left") {
    return {
      id: `${award.matchId}:${award.userId}:settlement`,
      matchId: award.matchId,
      sourceKey: `settlement:${award.matchId}`,
      kind: "match_settled",
      xp: award.xpGranted,
      label: "XP DA PARTIDA SALVO",
      detail: null,
      intensity: "terminal",
      occurredAt,
    };
  }

  const terminalXp = completionXp + victoryBonusXp;
  if (terminalXp <= 0) return null;
  const detailParts = [
    completionXp > 0 ? `Conclusão +${completionXp} XP` : null,
    victoryBonusXp > 0 ? `Vitória +${victoryBonusXp} XP` : null,
    `Total da partida ${award.xpGranted} XP`,
  ].filter((value): value is string => Boolean(value));

  return {
    id: `${award.matchId}:${award.userId}:settlement`,
    matchId: award.matchId,
    sourceKey: `settlement:${award.matchId}`,
    kind: victoryBonusXp > 0 ? "match_won" : "match_completed",
    xp: terminalXp,
    label: victoryBonusXp > 0 ? "VITÓRIA" : "PARTIDA CONCLUÍDA",
    detail: detailParts.join(" · "),
    intensity: "terminal",
    occurredAt,
  };
}

export async function resolveBattlePassMatchSnapshot(
  client: PoolClient,
): Promise<BattlePassMatchSnapshot | null> {
  await client.query("SELECT catalog.reconcile_battle_pass_season_lifecycle()");
  const row = (
    await client.query<ActiveSeasonRow>(
      `SELECT season.id AS season_id,
              profile.id AS profile_id,
              profile.action_model_version,
              profile.troop_placed_xp,
              profile.troop_placed_cap_xp,
              profile.card_trade_xp,
              profile.card_trade_cap_xp,
              profile.troop_lost_dice_xp,
              profile.troop_lost_dice_cap_xp,
              profile.enemy_troop_defeated_xp,
              profile.enemy_troop_defeated_cap_xp,
              profile.territory_first_conquest_xp,
              profile.territory_second_conquest_xp,
              profile.completion_xp,
              profile.victory_bonus_xp,
              profile.solo_human_bot_multiplier_bps
         FROM catalog.battle_pass_seasons season
         JOIN catalog.battle_pass_xp_profiles profile
           ON profile.id=season.xp_profile_id
        WHERE season.status='active'
          AND season.starts_at <= NOW()
          AND season.ends_at > NOW()
        ORDER BY season.starts_at DESC,season.id
        LIMIT 1`,
    )
  ).rows[0];

  if (!row) return null;

  return {
    seasonId: row.season_id,
    profileId: row.profile_id,
    profile: parseBattlePassXpProfile({
      actionModelVersion: Number(row.action_model_version),
      troopPlacedXp: Number(row.troop_placed_xp),
      troopPlacedCapXp: Number(row.troop_placed_cap_xp),
      cardTradeXp: Number(row.card_trade_xp),
      cardTradeCapXp: Number(row.card_trade_cap_xp),
      troopLostDiceXp: Number(row.troop_lost_dice_xp),
      troopLostDiceCapXp: Number(row.troop_lost_dice_cap_xp),
      enemyTroopDefeatedXp: Number(row.enemy_troop_defeated_xp),
      enemyTroopDefeatedCapXp: Number(row.enemy_troop_defeated_cap_xp),
      territoryFirstConquestXp: Number(row.territory_first_conquest_xp),
      territorySecondConquestXp: Number(row.territory_second_conquest_xp),
      completionXp: Number(row.completion_xp),
      victoryBonusXp: Number(row.victory_bonus_xp),
      soloHumanBotMultiplierBps: Number(row.solo_human_bot_multiplier_bps),
    }),
  };
}

async function loadThresholds(
  client: PoolClient,
  seasonId: string,
): Promise<BattlePassLevelThreshold[]> {
  const result = await client.query<{
    level: number;
    required_total_xp: string;
  }>(
    `SELECT level,required_total_xp::text
       FROM catalog.battle_pass_levels
      WHERE season_id=$1
      ORDER BY level`,
    [seasonId],
  );

  return result.rows.map((row) => ({
    level: Number(row.level),
    requiredTotalXp: Number(row.required_total_xp),
  }));
}

async function currentLevel(
  client: PoolClient,
  seasonId: string,
  userId: string,
) {
  const row = (
    await client.query<{ level_reached: number }>(
      `SELECT level_reached
         FROM progression.battle_pass_progress
        WHERE season_id=$1 AND user_id=$2::uuid`,
      [seasonId, userId],
    )
  ).rows[0];
  return Number(row?.level_reached ?? 1);
}

async function grantSeasonXp(
  client: PoolClient,
  input: Readonly<{
    seasonId: string;
    userId: string;
    matchId: string;
    amount: number;
    metadata: Record<string, unknown>;
  }>,
) {
  if (input.amount <= 0) {
    return {
      inserted: false,
      levelReached: await currentLevel(client, input.seasonId, input.userId),
    };
  }

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO progression.battle_pass_xp_entries(
       season_id,user_id,source_type,source_key,amount,metadata
     )
     VALUES($1,$2::uuid,'match',$3,$4,$5::jsonb)
     ON CONFLICT (season_id,user_id,source_type,source_key) DO NOTHING
     RETURNING id::text`,
    [
      input.seasonId,
      input.userId,
      input.matchId,
      input.amount,
      JSON.stringify(input.metadata),
    ],
  );

  if ((inserted.rowCount ?? 0) === 0) {
    return {
      inserted: false,
      levelReached: await currentLevel(client, input.seasonId, input.userId),
    };
  }

  const progress = (
    await client.query<{ xp_total: string }>(
      `INSERT INTO progression.battle_pass_progress(
         season_id,user_id,xp_total,level_reached
       )
       VALUES($1,$2::uuid,$3,1)
       ON CONFLICT (season_id,user_id) DO UPDATE
       SET xp_total=progression.battle_pass_progress.xp_total + EXCLUDED.xp_total,
           updated_at=NOW()
       RETURNING xp_total::text`,
      [input.seasonId, input.userId, input.amount],
    )
  ).rows[0];

  const totalXp = Number(progress?.xp_total ?? input.amount);
  const thresholds = await loadThresholds(client, input.seasonId);
  const levelReached = resolveBattlePassLevel(thresholds, totalXp);

  await client.query(
    `UPDATE progression.battle_pass_progress
        SET level_reached=$3,updated_at=NOW()
      WHERE season_id=$1 AND user_id=$2::uuid`,
    [input.seasonId, input.userId, levelReached],
  );

  return { inserted: true, levelReached };
}

async function settleAccumulatedParticipant(
  client: PoolClient,
  input: Readonly<{
    matchId: string;
    userId: string;
    profile: BattlePassXpProfile;
    completed: boolean;
    isWinner: boolean;
    reason: "match_completed" | "player_left";
  }>,
): Promise<BattlePassXpAward | null> {
  const progress = (
    await client.query<AccumulatedProgressRow>(
      `SELECT match_id::text,season_id,user_id::text,player_id_snapshot::text,
              multiplier_bps,raw_action_xp::text,scaled_action_xp::text,
              settled_at,settled_reason,settled_xp::text
         FROM progression.battle_pass_match_progress
        WHERE match_id=$1 AND user_id=$2::uuid
        FOR UPDATE`,
      [input.matchId, input.userId],
    )
  ).rows[0];

  if (!progress) return null;

  if (progress.settled_at) {
    return {
      userId: input.userId,
      seasonId: progress.season_id,
      matchId: input.matchId,
      xpGranted: 0,
      levelReached: await currentLevel(
        client,
        progress.season_id,
        input.userId,
      ),
      duplicate: true,
      actionXp: Number(progress.scaled_action_xp),
      completionXp: 0,
      victoryBonusXp: 0,
      settledReason: progress.settled_reason ?? input.reason,
    };
  }

  const rawActionXp = Number(progress.raw_action_xp);
  const actionXp = Number(progress.scaled_action_xp);
  const completionRaw = input.completed ? input.profile.completionXp : 0;
  const victoryRaw =
    input.completed && input.isWinner ? input.profile.victoryBonusXp : 0;
  const afterCompletion = scaleBattlePassXp(
    rawActionXp + completionRaw,
    progress.multiplier_bps,
  );
  const totalXp = scaleBattlePassXp(
    rawActionXp + completionRaw + victoryRaw,
    progress.multiplier_bps,
  );
  const completionXp = Math.max(0, afterCompletion - actionXp);
  const victoryBonusXp = Math.max(0, totalXp - afterCompletion);

  const grant = await grantSeasonXp(client, {
    seasonId: progress.season_id,
    userId: input.userId,
    matchId: input.matchId,
    amount: totalXp,
    metadata: {
      actionXp,
      rawActionXp,
      completionXp,
      victoryBonusXp,
      completionRawXp: completionRaw,
      victoryBonusRawXp: victoryRaw,
      multiplierBps: progress.multiplier_bps,
      actionModelVersion: input.profile.actionModelVersion,
      settledReason: input.reason,
      isWinner: input.completed && input.isWinner,
    },
  });

  await client.query(
    `UPDATE progression.battle_pass_match_progress
        SET settled_at=NOW(),
            settled_reason=$3,
            settled_xp=$4,
            updated_at=NOW()
      WHERE match_id=$1 AND user_id=$2::uuid`,
    [input.matchId, input.userId, input.reason, totalXp],
  );

  return {
    userId: input.userId,
    seasonId: progress.season_id,
    matchId: input.matchId,
    xpGranted: grant.inserted ? totalXp : 0,
    levelReached: grant.levelReached,
    duplicate: !grant.inserted && totalXp > 0,
    actionXp,
    completionXp,
    victoryBonusXp,
    settledReason: input.reason,
  };
}

async function awardLegacyMatchXp(
  client: PoolClient,
  input: Readonly<{
    matchId: string;
    seasonId: string;
    profileId: string;
    profile: BattlePassXpProfile;
    participants: ParticipantRow[];
  }>,
) {
  const humanParticipantCount = input.participants.filter(
    (participant) => !participant.is_bot,
  ).length;
  const awards: BattlePassXpAward[] = [];

  for (const participant of input.participants) {
    if (
      participant.is_bot ||
      !participant.user_id ||
      participant.left_at_snapshot !== null
    ) {
      continue;
    }

    const breakdown = calculateBattlePassMatchXp({
      profile: input.profile,
      completed: true,
      isWinner: participant.is_winner === true,
      humanParticipantCount,
    });
    if (breakdown.totalXp <= 0) continue;

    const grant = await grantSeasonXp(client, {
      seasonId: input.seasonId,
      userId: participant.user_id,
      matchId: input.matchId,
      amount: breakdown.totalXp,
      metadata: {
        completionXp: breakdown.completionXp,
        victoryBonusXp: breakdown.victoryBonusXp,
        multiplierBps: breakdown.multiplierBps,
        isWinner: participant.is_winner === true,
        humanParticipantCount,
        xpProfileId: input.profileId,
        actionModelVersion: 1,
      },
    });

    awards.push({
      userId: participant.user_id,
      seasonId: input.seasonId,
      matchId: input.matchId,
      xpGranted: grant.inserted ? breakdown.totalXp : 0,
      levelReached: grant.levelReached,
      duplicate: !grant.inserted,
    });
  }

  return awards;
}

export async function settleBattlePassPlayerExit(
  client: PoolClient,
  roomId: string,
  playerId: string,
): Promise<BattlePassXpAward | null> {
  const row = (
    await client.query<{
      match_id: string;
      user_id: string;
      battle_pass_xp_profile_snapshot: unknown;
    }>(
      `SELECT progress.match_id::text,
              progress.user_id::text,
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

  if (!row) return null;
  const profile = parseBattlePassXpProfile(
    row.battle_pass_xp_profile_snapshot,
  );
  if (profile.actionModelVersion < 2) return null;

  return settleAccumulatedParticipant(client, {
    matchId: row.match_id,
    userId: row.user_id,
    profile,
    completed: false,
    isWinner: false,
    reason: "player_left",
  });
}

export async function awardBattlePassMatchXp(
  client: PoolClient,
  matchId: string,
): Promise<BattlePassXpAward[]> {
  const match = (
    await client.query<MatchProgressionRow>(
      `SELECT battle_pass_season_id,battle_pass_xp_profile_id,
              battle_pass_xp_profile_snapshot
         FROM game.matches
        WHERE id=$1`,
      [matchId],
    )
  ).rows[0];

  if (
    !match?.battle_pass_season_id ||
    !match.battle_pass_xp_profile_id ||
    !match.battle_pass_xp_profile_snapshot
  ) {
    return [];
  }

  const profile = parseBattlePassXpProfile(
    match.battle_pass_xp_profile_snapshot,
  );
  const participants = (
    await client.query<ParticipantRow>(
      `SELECT user_id::text,player_id_snapshot::text,is_bot,is_winner,
              left_at_snapshot::text
         FROM game.match_participants
        WHERE match_id=$1
        ORDER BY player_id_snapshot`,
      [matchId],
    )
  ).rows;

  if (profile.actionModelVersion < 2) {
    return awardLegacyMatchXp(client, {
      matchId,
      seasonId: match.battle_pass_season_id,
      profileId: match.battle_pass_xp_profile_id,
      profile,
      participants,
    });
  }

  const awards: BattlePassXpAward[] = [];
  for (const participant of participants) {
    if (participant.is_bot || !participant.user_id) continue;
    const left = participant.left_at_snapshot !== null;
    const award = await settleAccumulatedParticipant(client, {
      matchId,
      userId: participant.user_id,
      profile,
      completed: !left,
      isWinner: !left && participant.is_winner === true,
      reason: left ? "player_left" : "match_completed",
    });
    if (award) awards.push(award);
  }

  return awards;
}
