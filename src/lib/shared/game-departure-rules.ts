export type DepartureRecipient = Readonly<{
  playerId: string;
  territoryCount: number;
}>;

export type TerritoryAssignment = Readonly<{
  territoryId: number;
  playerId: string;
}>;

export function balancedTerritoryAssignments(
  territoryIds: readonly number[],
  recipients: readonly DepartureRecipient[],
  chooseIndex: (exclusiveMax: number) => number,
): TerritoryAssignment[] {
  if (territoryIds.length === 0) return [];
  if (recipients.length === 0) {
    throw new RangeError("Redistribuição exige ao menos um destinatário.");
  }

  const counts = new Map(
    recipients.map((recipient) => {
      if (
        !Number.isSafeInteger(recipient.territoryCount) ||
        recipient.territoryCount < 0
      ) {
        throw new RangeError("Contagem territorial inválida.");
      }
      return [recipient.playerId, recipient.territoryCount] as const;
    }),
  );

  if (counts.size !== recipients.length) {
    throw new RangeError("Destinatários duplicados na redistribuição.");
  }

  const assignments: TerritoryAssignment[] = [];
  for (const territoryId of territoryIds) {
    const minimum = Math.min(...counts.values());
    const candidates = recipients.filter(
      (recipient) => counts.get(recipient.playerId) === minimum,
    );
    const selectedIndex =
      candidates.length === 1 ? 0 : chooseIndex(candidates.length);
    if (
      !Number.isSafeInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= candidates.length
    ) {
      throw new RangeError("Seleção aleatória inválida.");
    }

    const selected = candidates[selectedIndex];
    assignments.push({ territoryId, playerId: selected.playerId });
    counts.set(selected.playerId, minimum + 1);
  }

  return assignments;
}
