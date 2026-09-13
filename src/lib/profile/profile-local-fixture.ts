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
      title: "Estrategista do Sul",
      portrait: {
        src: null,
        alt: "Retrato do comandante Luigi",
      },
      presence: "online",
    },
  },
  wallet: {
    availability: "available",
    source: "local-static",
    data: {
      common: {
        currency: "campaign-credit",
        label: "Créditos de Campanha",
        shortLabel: "Créditos",
        symbol: "◈",
        balance: 18_420,
      },
      premium: {
        currency: "command-reserve",
        label: "Reserva de Comando",
        shortLabel: "Reserva",
        symbol: "◆",
        balance: 260,
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
          portrait: { src: null, alt: "Retrato de Marques" },
          presence: "in-match",
          contextLabel: "Em partida · Operação ativa",
        },
        {
          handle: "rafael_br",
          displayName: "Rafael",
          title: "Veterano da Fronteira",
          portrait: { src: null, alt: "Retrato de Rafael" },
          presence: "online",
          contextLabel: "Disponível para operações",
        },
        {
          handle: "amazonas77",
          displayName: "Amazonas77",
          title: null,
          portrait: { src: null, alt: "Retrato de Amazonas77" },
          presence: "in-lobby",
          contextLabel: "Em sala personalizada",
        },
      ],
      incomingRequests: [
        {
          handle: "guarapuava21",
          displayName: "Guarapuava21",
          title: "Observador do Sul",
          mutualContacts: 2,
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
          slug: "comando-imperial-frame",
          name: "Moldura Comando Imperial",
          category: "frame",
          artworkSrc: null,
          artworkAlt: "Prévia da Moldura Comando Imperial",
          price: { currency: "command-reserve", amount: 240 },
        },
        {
          slug: "marechal-ferro-title",
          name: "Título Marechal de Ferro",
          category: "title",
          artworkSrc: null,
          artworkAlt: "Prévia do título Marechal de Ferro",
          price: { currency: "campaign-credit", amount: 4_800 },
        },
        {
          slug: "sentinela-cerrado-portrait",
          name: "Retrato Sentinela do Cerrado",
          category: "portrait",
          artworkSrc: null,
          artworkAlt: "Prévia do retrato Sentinela do Cerrado",
          price: { currency: "command-reserve", amount: 180 },
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
    portrait: { src: null, alt: "Retrato de Marques" },
    mutualContacts: 4,
  },
  {
    handle: "marcelo_sp",
    displayName: "Marcelo SP",
    title: "Oficial de Reserva",
    portrait: { src: null, alt: "Retrato de Marcelo SP" },
    mutualContacts: 1,
  },
  {
    handle: "amazonas77",
    displayName: "Amazonas77",
    title: null,
    portrait: { src: null, alt: "Retrato de Amazonas77" },
    mutualContacts: 2,
  },
  {
    handle: "cerrado_ax",
    displayName: "Cerrado AX",
    title: "Sentinela do Cerrado",
    portrait: { src: null, alt: "Retrato de Cerrado AX" },
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
