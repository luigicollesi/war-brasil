import {
  REGION_REINFORCEMENT_BONUSES,
  TERRITORY_METADATA,
  type Region,
} from "./game-config";
import {
  attackProfile,
  BARRIER_ATTACK_DICE_BANDS,
  maneuverTraversalProfile,
} from "./game-barrier-rules";
import { reinforcementBase, tradeValue } from "./game-rules";

const REGION_GUIDE_ORDER: readonly Region[] = [
  "nordeste",
  "norte",
  "sudeste",
  "centro-oeste",
  "sul",
];

const REGION_GUIDE_LABELS: Record<Region, string> = {
  norte: "Norte",
  nordeste: "Nordeste",
  "centro-oeste": "Centro-Oeste",
  sudeste: "Sudeste",
  sul: "Sul",
};

export type GameGuidePresentation = ReturnType<typeof buildGameGuidePresentation>;

export function buildGameGuidePresentation() {
  const territoryCount = Object.keys(TERRITORY_METADATA).length;
  const regionCount = Object.keys(REGION_REINFORCEMENT_BONUSES).length;
  const reinforcementTerritoryExample = 12;
  const normalAttack = attackProfile(4, "normal");
  const barrierAttack = attackProfile(7, "barrier");
  const barrierUnavailable = attackProfile(3, "barrier");
  const oneBarrier = maneuverTraversalProfile(1);
  const twoBarriers = maneuverTraversalProfile(2);
  const regions = REGION_GUIDE_ORDER.map((region) => ({
    key: region,
    label: REGION_GUIDE_LABELS[region],
    territoryCount: Object.values(TERRITORY_METADATA).filter(
      (territory) => territory.region === region,
    ).length,
    bonus: REGION_REINFORCEMENT_BONUSES[region],
  }));

  if (
    normalAttack.kind !== "available" ||
    barrierAttack.kind !== "available" ||
    barrierUnavailable.kind !== "unavailable" ||
    oneBarrier.kind !== "barrier" ||
    twoBarriers.kind !== "blocked"
  ) {
    throw new Error("As regras do guia rápido ficaram incompatíveis com o jogo.");
  }

  return {
    territoryCount,
    regionCount,
    regions,
    setup: {
      initialTroopsPerTerritory: 1,
    },
    reinforcement: {
      territoryExample: reinforcementTerritoryExample,
      baseExample: reinforcementBase(reinforcementTerritoryExample),
      minimum: reinforcementBase(1),
    },
    attack: {
      normalMinimumTroops: 2,
      normalDiceAtFourTroops: normalAttack.diceCount,
      barrierMinimumTroops: barrierUnavailable.minimumTroops,
      barrierDiceAtSevenTroops: barrierAttack.diceCount,
      barrierLossPerComparison: barrierAttack.attackerLossPerComparison,
      barrierDiceBands: BARRIER_ATTACK_DICE_BANDS.map((band) => ({
        minimumTroops: band.minimumTroops,
        maximumTroops: band.maximumTroops,
        diceCount: band.diceCount,
      })),
    },
    maneuver: {
      barrierLoss: oneBarrier.troopLoss,
      barrierMinimumTroops: oneBarrier.minimumTroops,
      blockedBarrierCount: twoBarriers.minimumBarrierCount,
    },
    cards: {
      firstTradeValue: tradeValue(0),
    },
  };
}
