import {
  REGION_REINFORCEMENT_BONUSES,
  TERRITORY_METADATA,
} from "./game-config";
import { attackProfile, maneuverTraversalProfile } from "./game-barrier-rules";
import { reinforcementBase, tradeValue } from "./game-rules";

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
