export type ProfileCommandSource =
  | "local-static"
  | "authenticated-user"
  | "wallet-service"
  | "social-service"
  | "match-history"
  | "storefront-service"
  | "evaluation-fixture";

export type ProfileCommandState =
  | "guest"
  | "loaded"
  | "partial-data"
  | "empty-history"
  | "empty-social"
  | "empty-storefront";

export type ProfileCommandAvailability = "available" | "empty" | "unavailable";

export type ProfileCommandSection<T> = Readonly<{
  availability: ProfileCommandAvailability;
  source: ProfileCommandSource | null;
  unavailableReason?: string;
  data: T;
}>;

export type PlayerPresenceState = "online" | "offline" | "unavailable";
export type PlayerActivityState = "idle" | "lobby" | "match" | "unavailable";
export type ProfileVisibility = "public" | "friends" | "private";
export type FriendRequestPolicy = "everyone" | "friends_of_friends" | "nobody";

export type CommanderPresence = Readonly<{
  state: PlayerPresenceState;
  lastSeenAt: string | null;
}>;

export type CommanderActivity = Readonly<{
  state: PlayerActivityState;
  matchMode: "classic" | "custom" | null;
}>;

export type CommanderIdentity = Readonly<{
  displayName: string;
  handle: string;
  bio: string | null;
  title: string | null;
  presence: CommanderPresence;
  activity: CommanderActivity;
}>;

export type ProfilePrivacySettings = Readonly<{
  presenceVisibility: ProfileVisibility;
  activityVisibility: ProfileVisibility;
  historyVisibility: ProfileVisibility;
  friendRequestPolicy: FriendRequestPolicy;
}>;

export type CommandCurrencyId = "campaign-credit" | "command-reserve";

export type CommandCurrencyBalance = Readonly<{
  currency: CommandCurrencyId;
  label: string;
  shortLabel: string;
  symbol: string;
  balance: number;
}>;

export type PlayerWallet = Readonly<{
  common: CommandCurrencyBalance;
  premium: CommandCurrencyBalance;
}>;

export type CommanderContact = Readonly<{
  handle: string;
  displayName: string;
  title: string | null;
  presence: CommanderPresence;
  activity: CommanderActivity;
  contextLabel: string;
}>;

export type CommanderFriendRequest = Readonly<{
  requestId: string;
  handle: string;
  displayName: string;
  title: string | null;
  mutualContacts: number;
}>;

export type CommanderOutgoingFriendRequest = Readonly<{
  requestId: string;
  handle: string;
  displayName: string;
  title: string | null;
}>;

export type CommanderBlockedContact = Readonly<{
  handle: string;
  displayName: string;
  title: string | null;
}>;

export type RecentCommanderContact = Readonly<{
  handle: string;
  displayName: string;
  relation: "ally" | "opponent";
  operationCode: string;
  contextLabel: string;
}>;

export type PlayerSocialSnapshot = Readonly<{
  friends: ReadonlyArray<CommanderContact>;
  incomingRequests: ReadonlyArray<CommanderFriendRequest>;
  outgoingRequests: ReadonlyArray<CommanderOutgoingFriendRequest>;
  blockedCommanders: ReadonlyArray<CommanderBlockedContact>;
  recentContacts: ReadonlyArray<RecentCommanderContact>;
  totalFriends: number;
}>;

export type MatchParticipantSummary = Readonly<{
  handle: string | null;
  displayName: string;
  relation: "self" | "ally" | "opponent";
  isFriend: boolean;
}>;

export type MatchSummary = Readonly<{
  operationCode: string;
  playedAt: string;
  result: "victory" | "defeat" | "unknown";
  mode: "classic" | "custom" | "unknown";
  durationMinutes: number;
  participants: ReadonlyArray<MatchParticipantSummary>;
}>;

export type PlayerMatchHistory = Readonly<{
  matches: ReadonlyArray<MatchSummary>;
  hasMore: boolean;
  nextCursor: string | null;
}>;

export type PublicMatchParticipantSummary = Readonly<{
  handle: string | null;
  displayName: string;
  relation: "self" | "opponent";
}>;

export type PublicMatchSummary = Readonly<{
  operationCode: string;
  playedAt: string;
  result: "victory" | "defeat" | "unknown";
  mode: "classic" | "custom" | "unknown";
  durationMinutes: number;
  participants: ReadonlyArray<PublicMatchParticipantSummary>;
}>;

export type PublicPlayerMatchHistory = Readonly<{
  matches: ReadonlyArray<PublicMatchSummary>;
  hasMore: boolean;
  nextCursor: string | null;
}>;

export type StoreItemCategory = "frame" | "title" | "insignia";

export type StoreItemPreview = Readonly<{
  slug: string;
  name: string;
  category: StoreItemCategory;
  artworkSrc: string | null;
  artworkAlt: string;
  price: Readonly<{
    currency: CommandCurrencyId;
    amount: number;
  }>;
}>;

export type StoreShowcase = Readonly<{
  featuredItems: ReadonlyArray<StoreItemPreview>;
}>;

export type ProfileCommandSnapshot = Readonly<{
  state: ProfileCommandState;
  identity: ProfileCommandSection<CommanderIdentity | null>;
  privacy: ProfileCommandSection<ProfilePrivacySettings | null>;
  wallet: ProfileCommandSection<PlayerWallet | null>;
  social: ProfileCommandSection<PlayerSocialSnapshot>;
  history: ProfileCommandSection<PlayerMatchHistory>;
  storefront: ProfileCommandSection<StoreShowcase>;
  isEvaluationFixture: boolean;
}>;

export type CommanderSearchRelationship =
  | "none"
  | "outgoing-request"
  | "incoming-request"
  | "friend"
  | "blocked";

export type CommanderSearchResult = Readonly<{
  handle: string;
  displayName: string;
  title: string | null;
  relationship: CommanderSearchRelationship;
  mutualContacts: number;
}>;

export type PublicCommanderRelationship =
  | "self"
  | "none"
  | "outgoing-request"
  | "incoming-request"
  | "friend";

export type PublicCommanderProfileSnapshot = Readonly<{
  identity: CommanderIdentity;
  relationship: PublicCommanderRelationship;
  history: ProfileCommandSection<PublicPlayerMatchHistory>;
}>;

export type ProfileCommandStation =
  | "dossier"
  | "treasury"
  | "network"
  | "campaigns"
  | "quartermaster";
