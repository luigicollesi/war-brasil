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
import {
  maneuverMovableTroops,
  reinforcementBase,
  resolveBattle,
  tradeValue,
} from "./game-rules";

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

const MANDATORY_TRADE_HAND_SIZE = 5;
const OWNED_TERRITORY_CARD_BONUS = 2;
const CARD_REWARD_PER_CONQUERING_TURN = 1;

function availableNormalAttack(troops: number) {
  const profile = attackProfile(troops, "normal");
  if (profile.kind !== "available") {
    throw new Error("O exemplo de ataque normal do guia ficou indisponível.");
  }
  return profile;
}

function defenderDiceCount(troops: number): 1 | 2 | 3 {
  if (!Number.isInteger(troops) || troops < 1) {
    throw new RangeError("O exemplo de defesa precisa ter ao menos uma tropa.");
  }
  return Math.min(3, troops) as 1 | 2 | 3;
}

export type GameGuidePresentation = ReturnType<typeof buildGameGuidePresentation>;

export function buildGameGuidePresentation() {
  const territoryCount = Object.keys(TERRITORY_METADATA).length;
  const regionCount = Object.keys(REGION_REINFORCEMENT_BONUSES).length;
  const reinforcementTerritoryExample = 12;
  const reinforcementMinimumExampleTerritories = 5;
  const normalAttack = availableNormalAttack(4);
  const barrierAttack = attackProfile(7, "barrier");
  const barrierUnavailable = attackProfile(3, "barrier");
  const noBarrier = maneuverTraversalProfile(0);
  const oneBarrier = maneuverTraversalProfile(1);
  const twoBarriers = maneuverTraversalProfile(2);
  const combatExample = resolveBattle([6, 4, 2], [5, 4]);
  const comparisonCount = Math.min(
    combatExample.attacker.length,
    combatExample.defender.length,
  );
  const regions = REGION_GUIDE_ORDER.map((region) => ({
    key: region,
    label: REGION_GUIDE_LABELS[region],
    territoryCount: Object.values(TERRITORY_METADATA).filter(
      (territory) => territory.region === region,
    ).length,
    bonus: REGION_REINFORCEMENT_BONUSES[region],
  }));
  const normalDiceBands = [
    { minimumTroops: 2, maximumTroops: 2, diceCount: availableNormalAttack(2).diceCount },
    { minimumTroops: 3, maximumTroops: 3, diceCount: availableNormalAttack(3).diceCount },
    { minimumTroops: 4, maximumTroops: null, diceCount: normalAttack.diceCount },
  ] as const;
  const defenseDiceBands = [
    { minimumTroops: 1, maximumTroops: 1, diceCount: defenderDiceCount(1) },
    { minimumTroops: 2, maximumTroops: 2, diceCount: defenderDiceCount(2) },
    { minimumTroops: 3, maximumTroops: null, diceCount: defenderDiceCount(3) },
  ] as const;
  const tradeValues = Array.from({ length: 6 }, (_, index) => tradeValue(index));
  const maneuverExample = {
    sourceTroops: 5,
    alreadyMoved: 2,
  };

  if (
    barrierAttack.kind !== "available" ||
    barrierUnavailable.kind !== "unavailable" ||
    noBarrier.kind !== "normal" ||
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
      minimumExample: {
        territoryCount: reinforcementMinimumExampleTerritories,
        rawHalf: Math.floor(reinforcementMinimumExampleTerritories / 2),
        final: reinforcementBase(reinforcementMinimumExampleTerritories),
      },
    },
    attack: {
      normalMinimumTroops: normalAttack.minimumTroops,
      normalLossPerComparison: normalAttack.attackerLossPerComparison,
      normalDiceAtFourTroops: normalAttack.diceCount,
      normalDiceBands,
      barrierMinimumTroops: barrierUnavailable.minimumTroops,
      barrierDiceAtSevenTroops: barrierAttack.diceCount,
      barrierLossPerComparison: barrierAttack.attackerLossPerComparison,
      barrierDiceBands: BARRIER_ATTACK_DICE_BANDS.map((band) => ({
        minimumTroops: band.minimumTroops,
        maximumTroops: band.maximumTroops,
        diceCount: band.diceCount,
      })),
    },
    defense: {
      diceBands: defenseDiceBands,
    },
    combat: {
      example: {
        comparisons: Array.from({ length: comparisonCount }, (_, index) => {
          const attack = combatExample.attacker[index];
          const defense = combatExample.defender[index];
          return {
            key: `comparison-${index}`,
            attack,
            defense,
            loser: attack > defense ? ("defender" as const) : ("attacker" as const),
          };
        }),
        unpairedAttack: combatExample.attacker.slice(comparisonCount),
        unpairedDefense: combatExample.defender.slice(comparisonCount),
        attackerLosses: combatExample.attackerLosses,
        defenderLosses: combatExample.defenderLosses,
      },
    },
    conquest: {
      minimumMove: 1,
      minimumTroopsLeftAtOrigin: 1,
    },
    maneuver: {
      minimumTroopsLeftAtOrigin:
        maneuverExample.sourceTroops -
        maneuverMovableTroops(maneuverExample.sourceTroops, 0),
      barrierLoss: oneBarrier.troopLoss,
      barrierMinimumTroops: oneBarrier.minimumTroops,
      blockedBarrierCount: twoBarriers.minimumBarrierCount,
      normalLoss: noBarrier.troopLoss,
      example: {
        ...maneuverExample,
        movableBeforeReceiving: maneuverMovableTroops(
          maneuverExample.sourceTroops,
          0,
        ),
        movableAfterReceiving: maneuverMovableTroops(
          maneuverExample.sourceTroops,
          maneuverExample.alreadyMoved,
        ),
      },
    },
    cards: {
      cardsPerConqueringTurn: CARD_REWARD_PER_CONQUERING_TURN,
      mandatoryTradeHandSize: MANDATORY_TRADE_HAND_SIZE,
      ownedTerritoryBonus: OWNED_TERRITORY_CARD_BONUS,
      firstTradeValue: tradeValues[0],
      tradeValues,
      incrementPerPersonalTrade: tradeValue(1) - tradeValue(0),
    },
    anomalies: {
      minimumTroopsAfterRemoval: 1,
    },
  };
}
