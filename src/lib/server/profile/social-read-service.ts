import "server-only";

import type {
  CommanderBlockedContact,
  CommanderContact,
  CommanderFriendRequest,
  CommanderOutgoingFriendRequest,
  PlayerMatchHistory,
  PlayerSocialSnapshot,
  RecentCommanderContact,
} from "@/src/lib/profile/profile-command-contract";
import { getPresenceStates } from "./presence-gateway";
import {
  countFriends,
  listBlockedCommanderRows,
  listFriendRows,
  listIncomingFriendRequestRows,
  listOutgoingFriendRequestRows,
  type SocialFriendRow,
} from "./social-read-repository";

type PresenceBatch = Awaited<ReturnType<typeof getPresenceStates>>;

function activityFrom(row: SocialFriendRow): CommanderContact["activity"] {
  if (row.activity_visibility === "private") {
    return { state: "unavailable", matchMode: null };
  }
  if (row.active_room_status === "playing") {
    return { state: "match", matchMode: row.active_match_mode };
  }
  if (row.active_room_status === "waiting" || row.active_room_status === "order_roll") {
    return { state: "lobby", matchMode: row.active_match_mode };
  }
  return { state: "idle", matchMode: null };
}

function presenceFrom(
  row: SocialFriendRow,
  batch: PresenceBatch,
): CommanderContact["presence"] {
  if (row.presence_visibility === "private") {
    return { state: "unavailable", lastSeenAt: null };
  }

  const durableLastSeenAt = row.last_seen_at?.toISOString() ?? null;
  if (batch.availability !== "available") {
    return { state: "unavailable", lastSeenAt: durableLastSeenAt };
  }

  const live = batch.presences.get(row.user_id);
  if (!live) {
    return { state: "unavailable", lastSeenAt: durableLastSeenAt };
  }
  return {
    state: live.state,
    lastSeenAt: live.lastSeenAt ?? durableLastSeenAt,
  };
}

function contextLabel(contact: CommanderContact) {
  if (contact.activity.state === "match") return "Em partida · operação ativa";
  if (contact.activity.state === "lobby") return "Em sala de operações";
  if (contact.activity.state === "idle") return "Sem operação ativa";
  return "Atividade indisponível";
}

function friendFrom(row: SocialFriendRow, batch: PresenceBatch): CommanderContact {
  const contact: CommanderContact = {
    handle: row.handle,
    displayName: row.display_name,
    title: row.title_name,
    presence: presenceFrom(row, batch),
    activity: activityFrom(row),
    contextLabel: "",
  };
  return { ...contact, contextLabel: contextLabel(contact) };
}

function recentContactsFromHistory(
  userHandle: string,
  history: PlayerMatchHistory,
): RecentCommanderContact[] {
  const seen = new Set<string>();
  const recent: RecentCommanderContact[] = [];

  for (const match of history.matches) {
    for (const participant of match.participants) {
      if (!participant.handle || participant.handle === userHandle) continue;
      if (seen.has(participant.handle)) continue;
      seen.add(participant.handle);
      recent.push({
        handle: participant.handle,
        displayName: participant.displayName,
        relation: "opponent",
        operationCode: match.operationCode,
        contextLabel: `Participou de ${match.operationCode}`,
      });
      if (recent.length >= 6) return recent;
    }
  }

  return recent;
}

export async function getPlayerSocialSnapshot(
  userId: string,
  userHandle: string,
  history: PlayerMatchHistory | Promise<PlayerMatchHistory>,
): Promise<PlayerSocialSnapshot> {
  const [
    friendRows,
    incomingRows,
    outgoingRows,
    blockedRows,
    totalFriends,
    resolvedHistory,
  ] = await Promise.all([
    listFriendRows(userId, 50),
    listIncomingFriendRequestRows(userId, 50),
    listOutgoingFriendRequestRows(userId, 50),
    listBlockedCommanderRows(userId, 50),
    countFriends(userId),
    Promise.resolve(history),
  ]);

  const presence = await getPresenceStates(
    friendRows
      .filter((row) => row.presence_visibility !== "private")
      .map((row) => row.user_id),
  );
  const friends = friendRows.map((row) => friendFrom(row, presence));
  const incomingRequests: CommanderFriendRequest[] = incomingRows.map((row) => ({
    requestId: row.id,
    handle: row.handle,
    displayName: row.display_name,
    title: row.title_name,
    mutualContacts: row.mutual_contacts,
  }));
  const outgoingRequests: CommanderOutgoingFriendRequest[] = outgoingRows.map(
    (row) => ({
      requestId: row.id,
      handle: row.handle,
      displayName: row.display_name,
      title: row.title_name,
    }),
  );
  const blockedCommanders: CommanderBlockedContact[] = blockedRows.map((row) => ({
    handle: row.handle,
    displayName: row.display_name,
    title: row.title_name,
  }));

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    blockedCommanders,
    recentContacts: recentContactsFromHistory(userHandle, resolvedHistory),
    totalFriends,
  };
}
