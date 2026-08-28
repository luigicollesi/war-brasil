export type BarrierActionSummary = {
  name: string;
  detail: string;
  blocked: boolean;
};

function barrierName(name: string | null | undefined) {
  return name ?? "Barreira natural";
}

export function barrierAttackSummary(input: {
  barrierName?: string | null;
  selectable: boolean;
  minimumTroops: number;
  lossPerComparison?: number;
}): BarrierActionSummary {
  if (!input.selectable) {
    return {
      name: barrierName(input.barrierName),
      detail: `Precisa de ${input.minimumTroops} tropas para atacar`,
      blocked: true,
    };
  }

  const loss = input.lossPerComparison ?? 3;
  return {
    name: barrierName(input.barrierName),
    detail: `Confronto perdido: −${loss} tropas`,
    blocked: false,
  };
}

export function barrierManeuverSummary(input: {
  barrierName?: string | null;
  selectable: boolean;
  minimumTroops: number;
  troopLoss: number;
}): BarrierActionSummary {
  if (!input.selectable) {
    return {
      name: barrierName(input.barrierName),
      detail: `Precisa mover ao menos ${input.minimumTroops} tropas`,
      blocked: true,
    };
  }

  return {
    name: barrierName(input.barrierName),
    detail: `Travessia: −${input.troopLoss} tropa`,
    blocked: false,
  };
}
