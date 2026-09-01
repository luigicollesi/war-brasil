import type { Region } from "@/src/lib/game-config";

const REGION_LABELS: Record<Region, string> = {
  norte: "Norte",
  nordeste: "Nordeste",
  "centro-oeste": "Centro-Oeste",
  sudeste: "Sudeste",
  sul: "Sul",
};

type ObjectivePresentationInput = {
  type: string;
  fallbackDescription: string;
  params: Record<string, unknown>;
};

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function regionList(value: unknown): Region[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const regions = value.filter(
    (region): region is Region =>
      typeof region === "string" && region in REGION_LABELS,
  );
  return regions.length === value.length ? regions : null;
}

function joinRegionLabels(regions: readonly Region[]) {
  const labels = regions.map((region) => REGION_LABELS[region]);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;
}

export function objectiveDescription(input: ObjectivePresentationInput) {
  const territories = positiveInteger(input.params.territories);

  if (input.type === "territories" && territories) {
    return `Controle pelo menos ${territories} territórios.`;
  }

  const regions = regionList(input.params.regions);
  if (input.type === "regions" && regions) {
    return `Domine completamente as regiões ${joinRegionLabels(regions)}.`;
  }

  if (input.type === "region_plus" && regions && territories) {
    return `Domine completamente as regiões ${joinRegionLabels(regions)} e controle pelo menos ${territories} territórios.`;
  }

  if (input.type === "elimination") {
    return territories
      ? `Elimine {targetPlayer} e controle pelo menos ${territories} territórios.`
      : "Elimine {targetPlayer}.";
  }

  return input.fallbackDescription;
}
