import "server-only";

import type { PublicPlayerMatchHistory } from "@/src/lib/profile/profile-command-contract";

export type ProfileVisibility = "public" | "friends" | "private";
export type FriendRequestPolicy = "everyone" | "friends_of_friends" | "nobody";
export type CommanderPresenceState = "online" | "offline" | "unavailable";
export type CommanderActivityState = "idle" | "lobby" | "match" | "unavailable";
export type CommanderRelationship =
  | "self"
  | "none"
  | "outgoing-request"
  | "incoming-request"
  | "friend"
  | "blocked";

export type CommanderTitleDto = Readonly<{
  id: string;
  name: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}>;

export type CommanderPresenceDto = Readonly<{
  state: CommanderPresenceState;
  lastSeenAt: string | null;
}>;

export type CommanderActivityDto = Readonly<{
  state: CommanderActivityState;
  matchMode: "classic" | "custom" | null;
}>;

export type CommanderIdentityDto = Readonly<{
  handle: string;
  displayName: string;
  bio: string | null;
  title: CommanderTitleDto | null;
  presence: CommanderPresenceDto;
  activity: CommanderActivityDto;
}>;

export type ProfilePrivacyDto = Readonly<{
  presenceVisibility: ProfileVisibility;
  activityVisibility: ProfileVisibility;
  historyVisibility: ProfileVisibility;
  friendRequestPolicy: FriendRequestPolicy;
}>;

export type OwnCommanderProfileDto = Readonly<{
  identity: CommanderIdentityDto;
  privacy: ProfilePrivacyDto;
}>;

export type PublicCommanderProfileDto = Readonly<{
  userId: string;
  identity: CommanderIdentityDto;
  relationship: Exclude<CommanderRelationship, "blocked">;
  history: Readonly<{
    visible: boolean;
    data: PublicPlayerMatchHistory | null;
  }>;
}>;

export type CommanderSearchDto = Readonly<{
  handle: string;
  displayName: string;
  title: CommanderTitleDto | null;
  relationship: Exclude<CommanderRelationship, "self">;
  mutualContacts: number;
}>;
