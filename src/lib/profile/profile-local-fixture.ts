import type {
  CommanderSearchResult,
  ProfileCommandSnapshot,
} from "./profile-command-contract";

export const LOCAL_PROFILE_COMMAND_SNAPSHOT: ProfileCommandSnapshot = {
  state: "loaded",
  identity: {
    availability: "available",
    source: "local-static",
    data: {
      displayName: "Luigi",
      handle: "luigi",
      bio: "Comandante em preparação para a próxima campanha.",
      title: "Estrategista do Sul",
      presence: { state: "online", lastSeenAt: null },
      activity: { state: "idle", matchMode: null },
    },
  },
  privacy: {
    availability: "available",
    source: "local-static",
    data: {
      presenceVisibility: "friends",
      activityVisibility: "friends",
      historyVisibility: "friends",
      friendRequestPolicy: "everyone",
    },
  },
  wallet: {
    availability: "available",
    source: "local-static",
    data: {
      campaignCredit: {
        currency: "campaign-credit",
        label: "Créditos de Campanha",
        shortLabel: "CRÉDITOS",
        symbol: "◈",
        balance: 0,
      },
    },
  },
  social: {
    availability: "available",
    source: "local-static",
    data: {
      friends: [
        {
          handle: "marques_13",
          displayName: "Marques",
          title: "Defensor do Planalto",
          presence: { state: "online", lastSeenAt: null },
          activity: { state: "match", matchMode: "classic" },
          contextLabel: "Em partida · Operação ativa",
        },
        {
          handle: "rafael_br",
          displayName: "Rafael",
          title: "Veterano da Fronteira",
          presence: { state: "online", lastSeenAt: null },
          activity: { state: "idle", matchMode: null },
          contextLabel: "Disponível para operações",
        },
        {
          handle: "amazonas77",
          displayName: "Amazonas77",
          title: null,
          presence: { state: "online", lastSeenAt: null },
          activity: { state: "lobby", matchMode: "custom" },
          contextLabel: "Em sala personalizada",
        },
      ],
      incomingRequests: [
        {
          requestId: "11111111-1111-4111-8111-111111111111",
          handle: "guarapuava21",
          displayName: "Guarapuava21",
          title: "Observador do Sul",
          mutualContacts: 2,
        },
      ],
      outgoingRequests: [
        {
          requestId: "22222222-2222-4222-8222-222222222222",
          handle: "serra_azul",
          displayName: "Serra Azul",
          title: null,
        },
      ],
      blockedCommanders: [
        {
          handle: "fronteira_x",
          displayName: "Fronteira X",
          title: null,
        },
      ],
      recentContacts: [
        {
          handle: "cerrado_ax",
          displayName: "Cerrado AX",
          relation: "ally",
          operationCode: "OP-0417",
          contextLabel: "Lutou ao seu lado na última operação",
        },
        {
          handle: "litoral_09",
          displayName: "Litoral 09",
          relation: "opponent",
          operationCode: "OP-0416",
          contextLabel: "Adversário recente",
        },
      ],
      totalFriends: 12,
    },
  },
  history: {
    availability: "available",
    source: "local-static",
    data: {
      matches: [
        {
          operationCode: "OP-0417",
          playedAt: "2026-09-11T22:40:00-03:00",
          result: "victory",
          mode: "classic",
          durationMinutes: 41,
          participants: [
            { handle: "luigi", displayName: "Luigi", relation: "self", isFriend: false },
            { handle: "marques_13", displayName: "Marques", relation: "ally", isFriend: true },
            { handle: "cerrado_ax", displayName: "Cerrado AX", relation: "ally", isFriend: false },
            { handle: "litoral_09", displayName: "Litoral 09", relation: "opponent", isFriend: false },
          ],
        },
        {
          operationCode: "OP-0416",
          playedAt: "2026-09-10T20:15:00-03:00",
          result: "defeat",
          mode: "custom",
          durationMinutes: 53,
          participants: [
            { handle: "luigi", displayName: "Luigi", relation: "self", isFriend: false },
            { handle: "rafael_br", displayName: "Rafael", relation: "ally", isFriend: true },
            { handle: "litoral_09", displayName: "Litoral 09", relation: "opponent", isFriend: false },
          ],
        },
        {
          operationCode: "OP-0415",
          playedAt: "2026-09-08T19:05:00-03:00",
          result: "victory",
          mode: "classic",
          durationMinutes: 34,
          participants: [
            { handle: "luigi", displayName: "Luigi", relation: "self", isFriend: false },
            { handle: "amazonas77", displayName: "Amazonas77", relation: "opponent", isFriend: true },
          ],
        },
      ],
      hasMore: true,
      nextCursor: "local-op-0415",
    },
  },
  storefront: {
    availability: "available",
    source: "local-static",
    data: {
      featuredItems: [
        {
          slug: "exercito-classico",
          name: "Exército Clássico",
          category: "dice-set",
          artworkSrc: null,
          artworkAlt: "Prévia do conjunto Exército Clássico",
          status: "announced",
          itemCount: 3,
        },
        {
          slug: "lancas-medievais",
          name: "Lanças Medievais",
          category: "dice-set",
          artworkSrc: null,
          artworkAlt: "Prévia do conjunto Lanças Medievais",
          status: "announced",
          itemCount: 3,
        },
        {
          slug: "viking",
          name: "Viking",
          category: "dice-set",
          artworkSrc: null,
          artworkAlt: "Prévia do conjunto Viking",
          status: "announced",
          itemCount: 3,
        },
      ],
    },
  },
  isEvaluationFixture: false,
};

const LOCAL_COMMANDER_DIRECTORY: ReadonlyArray<CommanderSearchResult> = [
  {
    handle: "marques_13",
    displayName: "Marques",
    title: "Defensor do Planalto",
    relationship: "friend",
    mutualContacts: 4,
  },
  {
    handle: "marcelo_sp",
    displayName: "Marcelo SP",
    title: "Oficial de Reserva",
    relationship: "none",
    mutualContacts: 1,
  },
  {
    handle: "amazonas77",
    displayName: "Amazonas77",
    title: null,
    relationship: "friend",
    mutualContacts: 2,
  },
  {
    handle: "cerrado_ax",
    displayName: "Cerrado AX",
    title: "Sentinela do Cerrado",
    relationship: "none",
    mutualContacts: 0,
  },
];

export function searchLocalCommanders(query: string): ReadonlyArray<CommanderSearchResult> {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  if (normalized.length < 2) return [];

  return LOCAL_COMMANDER_DIRECTORY.filter((commander) => {
    const haystack = `${commander.displayName} ${commander.handle}`.toLocaleLowerCase("pt-BR");
    return haystack.includes(normalized);
  }).slice(0, 8);
}
