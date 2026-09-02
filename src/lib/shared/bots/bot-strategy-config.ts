export const BOT_STRATEGY = {
  routing: {
    baseStepCost: 1,
    enemyTroopCost: 2.25,
    barrierCost: 18,
  },
  defense: {
    secondaryFrontierTarget: 2,
    keyFrontierTarget: 3,
    criticalGatewayTarget: 4,
  },
  attack: {
    minimumConquestProbability: 0.58,
    objectivePushProbability: 0.42,
    objectiveWeight: 120,
    routeWeight: 42,
    regionWeight: 32,
    positionalWeight: 14,
    conquestProbabilityWeight: 72,
    expectedLossWeight: 12,
    defenseDamageWeight: 24,
    attackThreshold: 34,
  },
  cards: {
    optionalTradeThreshold: 18,
    wildcardOpportunityCost: 5,
  },
} as const;
