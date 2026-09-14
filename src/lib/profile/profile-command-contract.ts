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

export type CommanderPresence = Readonly<{
  state: PlayerPresenceState;
  lastSeenAt: string | null;
}>;

export type CommanderActivity = Readonly<{
  state: PlayerActivityState;
  matchMode: "classic" | "custom" | null;
}>;

export type CommanderPortrait = Readonly<{
  src: string | null;
  alt: string;
}>;

export type CommanderIdentity = Readonly<{
  displayName: string;
  handle: string;
  title: string | null;
  portrait: CommanderPortrait;
  presence: CommanderPresence;
  activity: CommanderActivity;
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
  portrait: CommanderPortrait;
  presence: CommanderPresence;
  activity: CommanderActivity;
  contextLabel: string;
}>;

export type CommanderFriendRequest = Readonly<{
  handle: string;
  displayName: string;
  title: string | null;
  mutualContacts: number;
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

export type StoreItemCategory = "portrait" | "frame" | "title" | "insignia";

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
  wallet: ProfileCommandSection<PlayerWallet | null>;
  social: ProfileCommandSection<PlayerSocialSnapshot>;
  history: ProfileCommandSection<PlayerMatchHistory>;
  storefront: ProfileCommandSection<StoreShowcase>;
  isEvaluationFixture: boolean;
}>;

export type CommanderSearchResult = Readonly<{
  handle: string;
  displayName: string;
  title: string | null;
  portrait: CommanderPortrait;
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
  history: ProfileCommandSection<PlayerMatchHistory>;
}>;

export type ProfileCommandStation =
  | "dossier"
  | "treasury"
  | "network"
  | "campaigns"
  | "quartermaster";
