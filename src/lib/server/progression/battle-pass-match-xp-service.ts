import "server-only";

import type { PoolClient } from "pg";
import {
  calculateBattlePassMatchXp,
  parseBattlePassXpProfile,
  resolveBattlePassLevel,
} from "@/src/lib/shared/progression/battle-pass-xp";
import type {
  BattlePassLevelThreshold,
  BattlePassXpProfile,
} from "@/src/lib/shared/progression/battle-pass-contract";

type ActiveSeasonRow = {
  season_id: string;
  profile_id: string;
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
  is_bot: boolean;
  is_winner: boolean | null;
  left_at_snapshot: string | null;
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
}>;

export async function resolveBattlePassMatchSnapshot(
  client: PoolClient,
): Promise<BattlePassMatchSnapshot | null> {
  await client.query("SELECT catalog.reconcile_battle_pass_season_lifecycle()");
  const row = (
    await client.query<ActiveSeasonRow>(
      `SELECT season.id AS season_id,
              profile.id AS profile_id,
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
      `SELECT user_id::text,is_bot,is_winner,left_at_snapshot::text
         FROM game.match_participants
        WHERE match_id=$1
        ORDER BY player_id_snapshot`,
      [matchId],
    )
  ).rows;
  const humanParticipantCount = participants.filter(
    (participant) => !participant.is_bot,
  ).length;
  const thresholds = await loadThresholds(
    client,
    match.battle_pass_season_id,
  );
  const awards: BattlePassXpAward[] = [];

  for (const participant of participants) {
    if (
      participant.is_bot ||
      !participant.user_id ||
      participant.left_at_snapshot !== null
    ) {
      continue;
    }

    const breakdown = calculateBattlePassMatchXp({
      profile,
      completed: true,
      isWinner: participant.is_winner === true,
      humanParticipantCount,
    });
    if (breakdown.totalXp <= 0) continue;

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO progression.battle_pass_xp_entries(
         season_id,user_id,source_type,source_key,amount,metadata
       )
       VALUES($1,$2::uuid,'match',$3,$4,$5::jsonb)
       ON CONFLICT (season_id,user_id,source_type,source_key) DO NOTHING
       RETURNING id::text`,
      [
        match.battle_pass_season_id,
        participant.user_id,
        matchId,
        breakdown.totalXp,
        JSON.stringify({
          completionXp: breakdown.completionXp,
          victoryBonusXp: breakdown.victoryBonusXp,
          multiplierBps: breakdown.multiplierBps,
          isWinner: participant.is_winner === true,
          humanParticipantCount,
          xpProfileId: match.battle_pass_xp_profile_id,
        }),
      ],
    );

    if ((inserted.rowCount ?? 0) === 0) {
      const existing = await client.query<{
        xp_total: string;
        level_reached: number;
      }>(
        `SELECT xp_total::text,level_reached
           FROM progression.battle_pass_progress
          WHERE season_id=$1 AND user_id=$2::uuid`,
        [match.battle_pass_season_id, participant.user_id],
      );
      awards.push({
        userId: participant.user_id,
        seasonId: match.battle_pass_season_id,
        matchId,
        xpGranted: 0,
        levelReached: Number(existing.rows[0]?.level_reached ?? 1),
        duplicate: true,
      });
      continue;
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
        [
          match.battle_pass_season_id,
          participant.user_id,
          breakdown.totalXp,
        ],
      )
    ).rows[0];

    const totalXp = Number(progress?.xp_total ?? breakdown.totalXp);
    const levelReached = resolveBattlePassLevel(thresholds, totalXp);

    await client.query(
      `UPDATE progression.battle_pass_progress
          SET level_reached=$3,updated_at=NOW()
        WHERE season_id=$1 AND user_id=$2::uuid`,
      [match.battle_pass_season_id, participant.user_id, levelReached],
    );

    awards.push({
      userId: participant.user_id,
      seasonId: match.battle_pass_season_id,
      matchId,
      xpGranted: breakdown.totalXp,
      levelReached,
      duplicate: false,
    });
  }

  return awards;
}
