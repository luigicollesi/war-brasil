export const STORE_CATEGORY_IDS = [
  "dice",
  "territories",
  "backgrounds",
  "titles",
] as const;

export type StoreCategoryId = (typeof STORE_CATEGORY_IDS)[number];

export const STORE_CATEGORY_META: Readonly<
  Record<
    StoreCategoryId,
    Readonly<{
      label: string;
      kicker: string;
      description: string;
    }>
  >
> = {
  dice: {
    label: "Dados",
    kicker: "CATÁLOGO // EQUIPAMENTO DE COMBATE",
    description: "Personalize os dados usados durante seus confrontos.",
  },
  territories: {
    label: "Territórios",
    kicker: "CATÁLOGO // CAMPO DE BATALHA",
    description:
      "Aplique acabamentos visuais aos territórios sem alterar a leitura de jogo.",
  },
  backgrounds: {
    label: "Fundos",
    kicker: "CATÁLOGO // DOSSIÊ DO COMANDANTE",
    description: "Personalize a atmosfera visual do seu perfil e Dossiê.",
  },
  titles: {
    label: "Títulos",
    kicker: "CATÁLOGO // IDENTIDADE DO COMANDANTE",
    description:
      "Equipe títulos e estilos que acompanham sua identidade de comandante.",
  },
};

export function isStoreCategoryId(value: string): value is StoreCategoryId {
  switch (value) {
    case "dice":
    case "territories":
    case "backgrounds":
    case "titles":
      return true;
    default:
      return false;
  }
}
