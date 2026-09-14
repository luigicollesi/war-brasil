import "server-only";

import type {
  CommanderContact,
  CommanderFriendRequest,
  PlayerSocialSnapshot,
  RecentCommanderContact,
} from "@/src/lib/profile/profile-command-contract";
import type { PlayerMatchHistory } from "@/src/lib/profile/profile-command-contract";
import {
  countFriends,
  listFriendRows,
  listIncomingFriendRequestRows,
  type SocialFriendRow,
} from "./social-read-repository";

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

function contextLabel(contact: CommanderContact) {
  if (contact.activity.state === "match") return "Em partida · operação ativa";
  if (contact.activity.state === "lobby") return "Em sala de operações";
  if (contact.activity.state === "idle") return "Sem operação ativa";
  return "Atividade indisponível";
}

function friendFrom(row: SocialFriendRow): CommanderContact {
  const portraitSrc = safePortraitSrc(row.portrait_ref) ?? safePortraitSrc(row.auth_image);
  const contact: CommanderContact = {
    handle: row.handle,
    displayName: row.display_name,
    title: row.title_name,
    portrait: {
      src: portraitSrc,
      alt: `Retrato de ${row.display_name}`,
    },
    presence: {
      state: "unavailable",
      lastSeenAt:
        row.presence_visibility === "private"
          ? null
          : row.last_seen_at?.toISOString() ?? null,
    },
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
  history: PlayerMatchHistory,
): Promise<PlayerSocialSnapshot> {
  const [friendRows, requestRows, totalFriends] = await Promise.all([
    listFriendRows(userId, 20),
    listIncomingFriendRequestRows(userId, 10),
    countFriends(userId),
  ]);

  const friends = friendRows.map(friendFrom);
  const incomingRequests: CommanderFriendRequest[] = requestRows.map((row) => ({
    handle: row.handle,
    displayName: row.display_name,
    title: row.title_name,
    mutualContacts: row.mutual_contacts,
  }));

  return {
    friends,
    incomingRequests,
    recentContacts: recentContactsFromHistory(userHandle, history),
    totalFriends,
  };
}
