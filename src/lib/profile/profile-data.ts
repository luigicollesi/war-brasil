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
  | "progression-system";

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

const LOCAL_PROFILE: ProfileSnapshot = {
  state: "partial-data",
  identity: {
    displayName: "Luigi",
    source: "local-static",
    sourceLabel: "Perfil local temporário",
  },
  progression: {
    availability: "unavailable",
    source: null,
    unavailableReason: "Sistema de progressão ainda não integrado.",
    data: null,
  },
  statistics: {
    availability: "unavailable",
    source: null,
    unavailableReason: "Estatísticas ainda não possuem contrato de dados do perfil.",
    data: [],
  },
  history: {
    availability: "unavailable",
    source: null,
    unavailableReason: "Histórico de partidas ainda não está conectado ao perfil.",
    data: { campaigns: [], hasMore: false },
  },
  achievements: {
    availability: "unavailable",
    source: null,
    unavailableReason: "Conquistas ainda não possuem sistema de origem.",
    data: [],
  },
};

/**
 * Stable boundary between profile rendering and identity persistence.
 * Replace this local implementation with the future authenticated provider;
 * consumers should continue receiving the same ProfileSnapshot contract.
 *
 * History is intentionally bounded by the provider contract (`hasMore`) so a
 * future backend does not need to load an unlimited campaign archive at once.
 */
export async function getCurrentProfileSnapshot(): Promise<ProfileSnapshot> {
  return LOCAL_PROFILE;
}
