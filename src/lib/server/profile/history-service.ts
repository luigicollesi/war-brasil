import "server-only";

import type {
  MatchParticipantSummary,
  MatchSummary,
  PlayerMatchHistory,
} from "@/src/lib/profile/profile-command-contract";
import {
  listMatchHistoryRows,
  listMatchParticipantRows,
  type MatchHistoryCursor,
  type MatchHistoryParticipantRow,
} from "./history-repository";

const DEFAULT_HISTORY_LIMIT = 20;

function encodeCursor(cursor: MatchHistoryCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeMatchHistoryCursor(value: string | null | undefined): MatchHistoryCursor | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<MatchHistoryCursor>;
    if (
      typeof decoded.finishedAt !== "string" ||
      !Number.isFinite(Date.parse(decoded.finishedAt)) ||
      typeof decoded.matchId !== "string" ||
      !/^\d+$/.test(decoded.matchId)
    ) {
      return null;
    }
    return {
      finishedAt: decoded.finishedAt,
      matchId: decoded.matchId,
    };
  } catch {
    return null;
  }
}

function durationMinutes(startedAt: Date, finishedAt: Date) {
  return Math.max(1, Math.round((finishedAt.getTime() - startedAt.getTime()) / 60_000));
}

function participantSummary(
  participant: MatchHistoryParticipantRow,
  actorUserId: string,
): MatchParticipantSummary {
  return {
    handle: participant.handle_snapshot?.trim() || null,
    displayName:
      participant.display_name_snapshot.trim() ||
      participant.faction_name_snapshot.trim() ||
      "Comandante",
    relation:
      participant.user_id === actorUserId
        ? "self"
        : "opponent",
    isFriend: participant.is_friend,
  };
}

function operationCode(roomCode: string, sequence: number) {
  return sequence <= 1 ? roomCode : `${roomCode} · R${sequence}`;
}

export async function getPlayerMatchHistory(
  userId: string,
  options: Readonly<{ cursor?: string | null; limit?: number }> = {},
): Promise<PlayerMatchHistory> {
  const requestedLimit = options.limit ?? DEFAULT_HISTORY_LIMIT;
  const limit = Math.max(1, Math.min(50, Math.trunc(requestedLimit)));
  const cursor = decodeMatchHistoryCursor(options.cursor);
  const rows = await listMatchHistoryRows(userId, cursor, limit);
  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  const participants = await listMatchParticipantRows(
    userId,
    visibleRows.map((row) => row.match_id),
  );

  const participantsByMatch = new Map<string, MatchHistoryParticipantRow[]>();
  for (const participant of participants) {
    const current = participantsByMatch.get(participant.match_id) ?? [];
    current.push(participant);
    participantsByMatch.set(participant.match_id, current);
  }

  const matches: MatchSummary[] = visibleRows.map((row) => ({
    operationCode: operationCode(row.room_code, row.sequence),
    playedAt: row.finished_at.toISOString(),
    result:
      row.is_winner === true
        ? "victory"
        : row.is_winner === false
          ? "defeat"
          : "unknown",
    mode: row.match_mode_snapshot ?? "unknown",
    durationMinutes: durationMinutes(row.started_at, row.finished_at),
    participants: (participantsByMatch.get(row.match_id) ?? []).map((participant) =>
      participantSummary(participant, userId),
    ),
  }));

  const last = visibleRows.at(-1);
  return {
    matches,
    hasMore,
    nextCursor:
      hasMore && last
        ? encodeCursor({
            finishedAt: last.finished_at.toISOString(),
            matchId: last.match_id,
          })
        : null,
  };
}
