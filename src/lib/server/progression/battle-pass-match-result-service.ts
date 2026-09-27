import "server-only";

import { pool } from "@/src/lib/server/db/pool";
import { resolveBattlePassLevel } from "@/src/lib/shared/progression/battle-pass-xp";
import type {
  BattlePassLevelThreshold,
} from "@/src/lib/shared/progression/battle-pass-contract";
import type { BattlePassMatchResult } from "@/src/lib/shared/progression/battle-pass-presentation";
import { battlePassSettlementPresentationEvent } from "./battle-pass-match-xp-service";

type MatchResultRow = {
  entry_id: string;
  match_id: string;
  season_id: string;
  season_name: string;
  amount: string;
  metadata: unknown;
  cumulative_xp: string;
};

function safeInteger(value: unknown, fallback = 0) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function metadataObject(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function loadThresholds(seasonId: string) {
  const result = await pool.query<{
    level: number;
    required_total_xp: string;
  }>(
    `SELECT level,required_total_xp::text
       FROM catalog.battle_pass_levels
      WHERE season_id=$1
      ORDER BY level`,
    [seasonId],
  );

  return result.rows.map(
    (row) =>
      ({
        level: Number(row.level),
        requiredTotalXp: Number(row.required_total_xp),
      }) satisfies BattlePassLevelThreshold,
  );
}

export async function getBattlePassMatchResult(
  roomId: string,
  userId: string,
): Promise<BattlePassMatchResult | null> {
  if (!/^\d+$/.test(roomId)) return null;

  const row = (
    await pool.query<MatchResultRow>(
      `WITH latest_match AS (
         SELECT match.id
           FROM game.matches match
           JOIN game.match_participants participant
             ON participant.match_id=match.id
            AND participant.user_id=$2::uuid
            AND participant.is_bot=FALSE
          WHERE match.room_id=$1::bigint
            AND match.finished_at IS NOT NULL
          ORDER BY match.sequence DESC,match.id DESC
          LIMIT 1
       ),
       awarded AS (
         SELECT entry.id AS entry_id,
                latest_match.id AS match_id,
                entry.season_id,
                entry.amount,
                entry.metadata
           FROM latest_match
           JOIN progression.battle_pass_xp_entries entry
             ON entry.user_id=$2::uuid
            AND entry.source_type='match'
            AND entry.source_key=latest_match.id::text
       )
       SELECT awarded.entry_id::text,
              awarded.match_id::text,
              awarded.season_id,
              season.name AS season_name,
              awarded.amount::text,
              awarded.metadata,
              (
                SELECT COALESCE(SUM(history.amount),0)::text
                  FROM progression.battle_pass_xp_entries history
                 WHERE history.season_id=awarded.season_id
                   AND history.user_id=$2::uuid
                   AND history.id <= awarded.entry_id
              ) AS cumulative_xp
         FROM awarded
         JOIN catalog.battle_pass_seasons season
           ON season.id=awarded.season_id`,
      [roomId, userId],
    )
  ).rows[0];

  if (!row) return null;

  const xpGranted = safeInteger(row.amount);
  const totalXpAfter = safeInteger(row.cumulative_xp);
  const totalXpBefore = Math.max(0, totalXpAfter - xpGranted);
  const thresholds = await loadThresholds(row.season_id);
  const levelBefore = resolveBattlePassLevel(thresholds, totalXpBefore);
  const levelAfter = resolveBattlePassLevel(thresholds, totalXpAfter);
  const metadata = metadataObject(row.metadata);
  const actionXp = safeInteger(metadata.actionXp);
  const completionXp = safeInteger(metadata.completionXp);
  const victoryBonusXp = safeInteger(metadata.victoryBonusXp);
  const isWinner = metadata.isWinner === true || victoryBonusXp > 0;
  const terminalEvent = battlePassSettlementPresentationEvent({
    userId,
    seasonId: row.season_id,
    matchId: row.match_id,
    xpGranted,
    levelReached: levelAfter,
    duplicate: false,
    actionXp,
    completionXp,
    victoryBonusXp,
    settledReason: "match_completed",
  });

  return {
    seasonId: row.season_id,
    seasonName: row.season_name,
    matchId: row.match_id,
    xpGranted,
    totalXpAfter,
    levelBefore,
    levelAfter,
    levelsGained: Math.max(0, levelAfter - levelBefore),
    isWinner,
    presentationEvents: terminalEvent ? [terminalEvent] : [],
    breakdown: {
      actionXp,
      completionXp,
      victoryBonusXp,
      multiplierBps: Math.min(
        10_000,
        safeInteger(metadata.multiplierBps, 10_000),
      ),
      humanParticipantCount: safeInteger(metadata.humanParticipantCount),
    },
  };
}
