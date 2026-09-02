export const JURASSIC_TUNNEL_SOURCE_ID = 3;
export const JURASSIC_TUNNEL_EXCLUDED_TERRITORY_ID = 1;

export type RandomIndex = (exclusiveMax: number) => number;

export function jurassicTunnelCandidates(
  territoryIds: readonly number[],
  previousDestination: number | null,
): number[] {
  return territoryIds.filter(
    (territoryId) =>
      Number.isInteger(territoryId) &&
      territoryId > 0 &&
      territoryId !== JURASSIC_TUNNEL_EXCLUDED_TERRITORY_ID &&
      territoryId !== JURASSIC_TUNNEL_SOURCE_ID &&
      territoryId !== previousDestination,
  );
}

export function chooseJurassicTunnelDestination(
  territoryIds: readonly number[],
  previousDestination: number | null,
  randomIndex: RandomIndex,
): number {
  const candidates = jurassicTunnelCandidates(
    territoryIds,
    previousDestination,
  );

  if (candidates.length === 0) {
    throw new Error("Não existem destinos disponíveis para o Túnel Jurássico.");
  }

  const index = randomIndex(candidates.length);
  if (!Number.isInteger(index) || index < 0 || index >= candidates.length) {
    throw new RangeError("Índice aleatório inválido para o Túnel Jurássico.");
  }

  return candidates[index];
}
