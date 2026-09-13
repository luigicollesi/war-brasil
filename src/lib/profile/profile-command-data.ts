import type {
  CommanderSearchResult,
  PlayerMatchHistory,
  PlayerSocialSnapshot,
  PlayerWallet,
  ProfileCommandSection,
  ProfileCommandSnapshot,
  ProfileCommandState,
  StoreShowcase,
} from "./profile-command-contract";
import {
  LOCAL_PROFILE_COMMAND_SNAPSHOT,
  searchLocalCommanders,
} from "./profile-local-fixture";

type ProfileCommandEvaluationState =
  | ProfileCommandState
  | "wallet-unavailable"
  | "error";

const PROFILE_COMMAND_EVALUATION_STATES = new Set<ProfileCommandEvaluationState>([
  "guest",
  "loaded",
  "partial-data",
  "empty-history",
  "empty-social",
  "wallet-unavailable",
  "error",
]);

function unavailableSection<T>(data: T, unavailableReason: string): ProfileCommandSection<T> {
  return {
    availability: "unavailable",
    source: null,
    unavailableReason,
    data,
  };
}

function evaluationSection<T>(section: ProfileCommandSection<T>): ProfileCommandSection<T> {
  return {
    ...section,
    source: "evaluation-fixture",
  };
}

function createEvaluationSnapshot(state: Exclude<ProfileCommandEvaluationState, "error">): ProfileCommandSnapshot {
  const full: ProfileCommandSnapshot = {
    ...LOCAL_PROFILE_COMMAND_SNAPSHOT,
    state: "loaded",
    identity: {
      availability: "available",
      source: "evaluation-fixture",
      data: {
        displayName: "Comandante de avaliação",
        handle: "eval-command",
        title: "Título sintético de avaliação",
        portrait: { src: null, alt: "Retrato sintético de avaliação" },
        presence: "online",
      },
    },
    wallet: evaluationSection(LOCAL_PROFILE_COMMAND_SNAPSHOT.wallet),
    social: evaluationSection(LOCAL_PROFILE_COMMAND_SNAPSHOT.social),
    history: evaluationSection(LOCAL_PROFILE_COMMAND_SNAPSHOT.history),
    storefront: evaluationSection(LOCAL_PROFILE_COMMAND_SNAPSHOT.storefront),
    isEvaluationFixture: true,
  };

  if (state === "loaded") return full;

  if (state === "guest") {
    return {
      ...full,
      state: "guest",
      identity: unavailableSection(null, "Nenhuma identidade disponível neste cenário."),
      wallet: unavailableSection<PlayerWallet | null>(null, "Tesouraria indisponível sem identidade."),
      social: unavailableSection<PlayerSocialSnapshot>(
        { friends: [], incomingRequests: [], recentContacts: [], totalFriends: 0 },
        "Rede de Comando indisponível sem identidade.",
      ),
      history: unavailableSection<PlayerMatchHistory>(
        { matches: [], hasMore: false, nextCursor: null },
        "Livro de Campanha indisponível sem identidade.",
      ),
      storefront: unavailableSection<StoreShowcase>(
        { featuredItems: [] },
        "Intendência indisponível neste cenário.",
      ),
    };
  }

  if (state === "partial-data" || state === "wallet-unavailable") {
    return {
      ...full,
      state: "partial-data",
      wallet: unavailableSection<PlayerWallet | null>(
        null,
        "Tesouraria intencionalmente indisponível neste cenário de avaliação.",
      ),
      social:
        state === "partial-data"
          ? unavailableSection<PlayerSocialSnapshot>(
              { friends: [], incomingRequests: [], recentContacts: [], totalFriends: 0 },
              "Rede de Comando ainda não possui fonte disponível neste cenário.",
            )
          : full.social,
      history:
        state === "partial-data"
          ? unavailableSection<PlayerMatchHistory>(
              { matches: [], hasMore: false, nextCursor: null },
              "Livro de Campanha ainda não possui fonte disponível neste cenário.",
            )
          : full.history,
      storefront:
        state === "partial-data"
          ? unavailableSection<StoreShowcase>(
              { featuredItems: [] },
              "Intendência ainda não possui fonte disponível neste cenário.",
            )
          : full.storefront,
    };
  }

  if (state === "empty-history") {
    return {
      ...full,
      state: "empty-history",
      history: {
        availability: "empty",
        source: "evaluation-fixture",
        data: { matches: [], hasMore: false, nextCursor: null },
      },
    };
  }

  return {
    ...full,
    state: "empty-social",
    social: {
      availability: "empty",
      source: "evaluation-fixture",
      data: { friends: [], incomingRequests: [], recentContacts: [], totalFriends: 0 },
    },
  };
}

function getEvaluationStateFromEnvironment(): ProfileCommandEvaluationState | null {
  if (process.env.PROFILE_EVAL_MODE !== "1") return null;

  const requested = process.env.PROFILE_EVAL_STATE;
  if (!requested || !PROFILE_COMMAND_EVALUATION_STATES.has(requested as ProfileCommandEvaluationState)) {
    return null;
  }

  return requested as ProfileCommandEvaluationState;
}

/**
 * Stable boundary for the Quartel do Comandante redesign.
 *
 * Today it intentionally returns local-static data so the full interface can be
 * built before authentication, wallet, social, history and storefront services
 * exist. Future adapters should replace this implementation without exposing
 * provider-specific payloads to React components.
 */
export async function getCurrentProfileCommandSnapshot(): Promise<ProfileCommandSnapshot> {
  const evaluationState = getEvaluationStateFromEnvironment();

  if (evaluationState === "error") {
    throw new Error("PROFILE_COMMAND_EVAL_ERROR");
  }

  if (evaluationState) {
    return createEvaluationSnapshot(evaluationState);
  }

  return LOCAL_PROFILE_COMMAND_SNAPSHOT;
}

/**
 * Search is intentionally separate from the main snapshot so the profile never
 * needs to load a global player directory just to render the Rede de Comando.
 */
export async function searchProfileCommanders(
  query: string,
): Promise<ReadonlyArray<CommanderSearchResult>> {
  return searchLocalCommanders(query);
}
