import "server-only";

import type { PublicPlayerMatchHistory } from "@/src/lib/profile/profile-command-contract";
import type {
  CommanderIdentityDto,
  CommanderPortraitDto,
  CommanderRelationship,
  CommanderSearchDto,
  CommanderTitleDto,
  OwnCommanderProfileDto,
  ProfileVisibility,
  PublicCommanderProfileDto,
} from "./profile-domain";
import {
  findCommanderByHandle,
  findCommanderByUserId,
  searchCommanderDirectoryRows,
  type CommanderProfileRow,
  type CommanderSearchRow,
} from "./profile-repository";
import { getCommanderActivity } from "./activity-service";
import { getPlayerMatchHistory } from "./history-service";
import { getSocialRelationship } from "./social-repository";

function safePortraitSrc(value: string | null) {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function portraitFromRow(row: CommanderProfileRow | CommanderSearchRow): CommanderPortraitDto {
  const displayName = row.display_name?.trim() || row.handle?.trim() || "Comandante";
  const selected = safePortraitSrc(row.portrait_ref);
  const authFallback = safePortraitSrc(row.auth_image);
  return {
    src: selected ?? authFallback,
    alt: `Retrato de ${displayName}`,
  };
}

function titleFromRow(row: CommanderProfileRow | CommanderSearchRow): CommanderTitleDto | null {
  if (!row.title_id || !row.title_name || !row.title_rarity) return null;
  return {
    id: row.title_id,
    name: row.title_name,
    rarity: row.title_rarity,
  };
}

function identityFromRow(row: CommanderProfileRow): CommanderIdentityDto | null {
  const handle = row.handle?.trim();
  const displayName = row.display_name?.trim();
  if (!handle || !displayName) return null;

  return {
    handle,
    displayName,
    bio: row.bio?.trim() || null,
    portrait: portraitFromRow(row),
    title: titleFromRow(row),
    presence: {
      state: "unavailable",
      lastSeenAt: row.last_seen_at?.toISOString() ?? null,
    },
    activity: {
      state: "unavailable",
      matchMode: null,
    },
  };
}

function visibilityAllows(
  visibility: ProfileVisibility,
  relationship: Exclude<CommanderRelationship, "blocked">,
) {
  if (relationship === "self" || visibility === "public") return true;
  return visibility === "friends" && relationship === "friend";
}

function publicHistoryFromOwnerHistory(
  history: Awaited<ReturnType<typeof getPlayerMatchHistory>>,
): PublicPlayerMatchHistory {
  return {
    matches: history.matches.map((match) => ({
      operationCode: match.operationCode,
      playedAt: match.playedAt,
      result: match.result,
      mode: match.mode,
      durationMinutes: match.durationMinutes,
      participants: match.participants.map((participant) => ({
        handle: participant.handle,
        displayName: participant.displayName,
        relation: participant.relation === "self" ? "self" : "opponent",
      })),
    })),
    hasMore: history.hasMore,
    nextCursor: history.nextCursor,
  };
}

export async function getOwnCommanderProfile(
  userId: string,
): Promise<OwnCommanderProfileDto | null> {
  const row = await findCommanderByUserId(userId);
  if (!row) return null;
  const identity = identityFromRow(row);
  if (!identity) return null;

  return {
    identity,
    privacy: {
      presenceVisibility: row.presence_visibility,
      activityVisibility: row.activity_visibility,
      historyVisibility: row.history_visibility,
      friendRequestPolicy: row.friend_request_policy,
    },
  };
}

export async function getPublicCommanderProfile(
  actorUserId: string,
  handle: string,
): Promise<PublicCommanderProfileDto | null> {
  const row = await findCommanderByHandle(handle);
  if (!row) return null;
  const identity = identityFromRow(row);
  if (!identity) return null;

  const relationship: CommanderRelationship =
    row.user_id === actorUserId
      ? "self"
      : await getSocialRelationship(actorUserId, row.user_id);
  if (relationship === "blocked") return null;

  const presenceVisible = visibilityAllows(
    row.presence_visibility,
    relationship,
  );
  const activityVisible = visibilityAllows(
    row.activity_visibility,
    relationship,
  );
  const historyVisible = visibilityAllows(
    row.history_visibility,
    relationship,
  );

  const [activity, ownerHistory] = await Promise.all([
    activityVisible
      ? getCommanderActivity(row.user_id)
      : Promise.resolve(null),
    historyVisible
      ? getPlayerMatchHistory(row.user_id, { limit: 20 })
      : Promise.resolve(null),
  ]);

  return {
    identity: {
      ...identity,
      presence: presenceVisible
        ? identity.presence
        : { state: "unavailable", lastSeenAt: null },
      activity:
        activityVisible && activity
          ? activity
          : { state: "unavailable", matchMode: null },
    },
    relationship,
    history: {
      visible: historyVisible,
      data: ownerHistory ? publicHistoryFromOwnerHistory(ownerHistory) : null,
    },
  };
}

export async function searchCommanderDirectory(
  actorUserId: string,
  query: string,
): Promise<CommanderSearchDto[]> {
  const normalized = query.trim();
  if (normalized.length < 2 || normalized.length > 64) return [];

  const rows = await searchCommanderDirectoryRows(actorUserId, normalized, 8);
  return rows.flatMap((row) => {
    const handle = row.handle?.trim();
    const displayName = row.display_name?.trim();
    if (!handle || !displayName) return [];
    return [
      {
        handle,
        displayName,
        portrait: portraitFromRow(row),
        title: titleFromRow(row),
        relationship: row.relationship,
        mutualContacts: row.mutual_contacts,
      } satisfies CommanderSearchDto,
    ];
  });
}
