import "server-only";

import type { PublicPlayerMatchHistory } from "@/src/lib/profile/profile-command-contract";
import type {
  CommanderIdentityDto,
  CommanderRelationship,
  CommanderSearchDto,
  CommanderTitleDto,
  OwnCommanderProfileDto,
  ProfileVisibility,
  PublicCommanderProfileDto,
} from "./profile-domain";
import { getCommanderActivity } from "./activity-service";
import { getPlayerMatchHistory } from "./history-service";
import { getPresenceStates } from "./presence-gateway";
import {
  findCommanderByHandle,
  findCommanderByUserId,
  searchCommanderDirectoryRows,
  type CommanderProfileRow,
  type CommanderSearchRow,
} from "./profile-repository";
import { getSocialRelationship } from "./social-repository";

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

async function relationshipForRow(actorUserId: string, row: CommanderProfileRow) {
  const relationship: CommanderRelationship =
    row.user_id === actorUserId
      ? "self"
      : await getSocialRelationship(actorUserId, row.user_id);
  return relationship;
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

export async function getPublicCommanderHistory(
  actorUserId: string,
  handle: string,
  options: Readonly<{ cursor?: string | null; limit?: number }> = {},
): Promise<Readonly<{ visible: boolean; data: PublicPlayerMatchHistory | null }> | null> {
  const row = await findCommanderByHandle(handle);
  if (!row?.handle || !row.display_name) return null;

  const relationship = await relationshipForRow(actorUserId, row);
  if (relationship === "blocked") return null;

  const visible = visibilityAllows(row.history_visibility, relationship);
  if (!visible) return { visible: false, data: null };

  const history = await getPlayerMatchHistory(row.user_id, options);
  return {
    visible: true,
    data: publicHistoryFromOwnerHistory(history),
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

  const relationship = await relationshipForRow(actorUserId, row);
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

  const [activity, ownerHistory, presenceBatch] = await Promise.all([
    activityVisible
      ? getCommanderActivity(row.user_id)
      : Promise.resolve(null),
    historyVisible
      ? getPlayerMatchHistory(row.user_id, { limit: 20 })
      : Promise.resolve(null),
    presenceVisible
      ? getPresenceStates([row.user_id])
      : Promise.resolve(null),
  ]);

  const livePresence =
    presenceVisible && presenceBatch?.availability === "available"
      ? presenceBatch.presences.get(row.user_id) ?? null
      : null;

  return {
    identity: {
      ...identity,
      presence: !presenceVisible
        ? { state: "unavailable", lastSeenAt: null }
        : livePresence
          ? {
              state: livePresence.state,
              lastSeenAt: livePresence.lastSeenAt ?? identity.presence.lastSeenAt,
            }
          : {
              state: "unavailable",
              lastSeenAt: identity.presence.lastSeenAt,
            },
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
        title: titleFromRow(row),
        relationship: row.relationship,
        mutualContacts: row.mutual_contacts,
      } satisfies CommanderSearchDto,
    ];
  });
}
