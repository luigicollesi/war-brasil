export type ProfileState =
  | "guest"
  | "loading"
  | "loaded"
  | "empty-history"
  | "partial-data"
  | "no-progression-system"
  | "error";

export type ProfileAvailability = "available" | "empty" | "unavailable";
export type ProfileSource =
  | "local-static"
  | "authenticated-user"
  | "match-history"
  | "progression-system"
  | "evaluation-fixture";

export type ProfileIdentity = {
  displayName: string;
  source: Extract<ProfileSource, "local-static" | "authenticated-user">;
  sourceLabel: string;
};

export type ProfileSection<T> = {
  availability: ProfileAvailability;
  source: ProfileSource | null;
  unavailableReason?: string;
  data: T;
};

export type ProfileProgression = {
  title: string;
  detail?: string;
};

export type ProfileStatistic = {
  label: string;
  value: string;
};

export type ProfileCampaign = {
  title: string;
  summary: string;
};

export type ProfileHistory = {
  campaigns: ReadonlyArray<ProfileCampaign>;
  hasMore: boolean;
};

export type ProfileAchievement = {
  name: string;
  description: string;
};

export type ProfileSnapshot = {
  state: ProfileState;
  identity: ProfileIdentity | null;
  progression: ProfileSection<ProfileProgression | null>;
  statistics: ProfileSection<ReadonlyArray<ProfileStatistic>>;
  history: ProfileSection<ProfileHistory>;
  achievements: ProfileSection<ReadonlyArray<ProfileAchievement>>;
};

export const PROFILE_STATE_COPY: Record<
  ProfileState,
  { label: string; title: string; description: string }
> = {
  guest: {
    label: "Identidade ausente",
    title: "Nenhum comandante identificado",
    description:
      "Esta sessão ainda não possui uma identidade de perfil disponível. O Salão permanece acessível sem inventar dados ou um fluxo de autenticação.",
  },
  loading: {
    label: "Consultando arquivo",
    title: "Recuperando registro de comando",
    description: "A estrutura do Salão permanece estável enquanto os dados são carregados.",
  },
  loaded: {
    label: "Registro disponível",
    title: "Arquivo de comando sincronizado",
    description: "Os dados exibidos abaixo possuem fonte identificável no produto.",
  },
  "empty-history": {
    label: "Arquivo vazio",
    title: "Nenhuma campanha registrada",
    description:
      "O histórico está disponível, mas ainda não contém campanhas para esta identidade.",
  },
  "partial-data": {
    label: "Registro parcial",
    title: "Identidade disponível; sistemas em formação",
    description:
      "Somente informações com origem conhecida são exibidas. Progressão, estatísticas e honrarias permanecem indisponíveis até terem uma fonte real.",
  },
  "no-progression-system": {
    label: "Progressão indisponível",
    title: "Patentes ainda não foram instituídas",
    description:
      "O produto ainda não possui um sistema de progressão conectado a este perfil; nenhum nível ou patente é estimado.",
  },
  error: {
    label: "Arquivo indisponível",
    title: "Não foi possível abrir o registro",
    description:
      "A identidade não será substituída por valores simulados. Tente novamente quando a fonte de dados estiver disponível.",
  },
};

const LOCAL_IDENTITY: ProfileIdentity = {
  displayName: "Luigi",
  source: "local-static",
  sourceLabel: "Perfil local temporário",
};

function unavailableSection<T>(data: T, unavailableReason: string): ProfileSection<T> {
  return {
    availability: "unavailable",
    source: null,
    unavailableReason,
    data,
  };
}

function unavailableProfileSections() {
  return {
    progression: unavailableSection<ProfileProgression | null>(
      null,
      "Sistema de progressão ainda não integrado.",
    ),
    statistics: unavailableSection<ReadonlyArray<ProfileStatistic>>(
      [],
      "Estatísticas ainda não possuem contrato de dados do perfil.",
    ),
    history: unavailableSection<ProfileHistory>(
      { campaigns: [], hasMore: false },
      "Histórico de partidas ainda não está conectado ao perfil.",
    ),
    achievements: unavailableSection<ReadonlyArray<ProfileAchievement>>(
      [],
      "Conquistas ainda não possuem sistema de origem.",
    ),
  };
}

const LOCAL_PROFILE: ProfileSnapshot = {
  state: "partial-data",
  identity: LOCAL_IDENTITY,
  ...unavailableProfileSections(),
};

type ProfileEvaluationState = Exclude<ProfileState, "loading">;

const PROFILE_EVALUATION_STATES = new Set<ProfileEvaluationState>([
  "guest",
  "loaded",
  "empty-history",
  "partial-data",
  "no-progression-system",
  "error",
]);

function isProfileEvaluationState(value: string): value is ProfileEvaluationState {
  return PROFILE_EVALUATION_STATES.has(value as ProfileEvaluationState);
}

/**
 * Deterministic visual-evaluation fixtures.
 *
 * They are opt-in through PROFILE_EVAL_MODE=1 and are never selected by URL,
 * cookies or browser input. Fixtures intentionally avoid competitive numbers,
 * ranks and achievements; their only purpose is to exercise structural states.
 */
function createEvaluationSnapshot(state: ProfileEvaluationState): ProfileSnapshot {
  const base: ProfileSnapshot = {
    state,
    identity: LOCAL_IDENTITY,
    ...unavailableProfileSections(),
  };

  if (state === "guest" || state === "error") {
    return {
      ...base,
      identity: null,
    };
  }

  if (state === "empty-history") {
    return {
      ...base,
      history: {
        availability: "empty",
        source: "evaluation-fixture",
        data: { campaigns: [], hasMore: false },
      },
    };
  }

  return base;
}

function getEvaluationStateFromEnvironment(): ProfileEvaluationState | null {
  if (process.env.PROFILE_EVAL_MODE !== "1") {
    return null;
  }

  const requestedState = process.env.PROFILE_EVAL_STATE;
  if (!requestedState || !isProfileEvaluationState(requestedState)) {
    return null;
  }

  return requestedState;
}

/**
 * Stable boundary between profile rendering and identity persistence.
 * Replace this local implementation with the future authenticated provider;
 * consumers should continue receiving the same ProfileSnapshot contract.
 *
 * History is intentionally bounded by the provider contract (`hasMore`) so a
 * future backend does not need to load an unlimited campaign archive at once.
 */
export async function getCurrentProfileSnapshot(): Promise<ProfileSnapshot> {
  const evaluationState = getEvaluationStateFromEnvironment();
  if (evaluationState) {
    return createEvaluationSnapshot(evaluationState);
  }

  return LOCAL_PROFILE;
}
