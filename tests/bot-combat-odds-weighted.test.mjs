import assert from "node:assert/strict";
import test from "node:test";
import { battleRoundOutcomes } from "../.test-build/shared/bots/bot-combat-odds.js";
import { UNIFORM_DICE_DISTRIBUTION } from "../.test-build/shared/dice-balance.js";

const alwaysOne = [1, 0, 0, 0, 0, 0];
const alwaysSix = [0, 0, 0, 0, 0, 1];

test("engine de odds aceita distribuições ponderadas por lado", () => {
  const attackerWins = battleRoundOutcomes(1, 1, alwaysSix, alwaysOne);
  assert.deepEqual(attackerWins, [
    {
      probability: 1,
      attackerComparisonsLost: 0,
      defenderLosses: 1,
    },
  ]);

  const defenderWins = battleRoundOutcomes(1, 1, alwaysOne, alwaysSix);
  assert.deepEqual(defenderWins, [
    {
      probability: 1,
      attackerComparisonsLost: 1,
      defenderLosses: 0,
    },
  ]);
});

test("forecast round padrão continua equivalente à distribuição uniforme explícita", () => {
  const implicit = battleRoundOutcomes(3, 3);
  const explicit = battleRoundOutcomes(
    3,
    3,
    UNIFORM_DICE_DISTRIBUTION,
    UNIFORM_DICE_DISTRIBUTION,
  );

  assert.deepEqual(implicit, explicit);
  assert.ok(
    Math.abs(implicit.reduce((sum, outcome) => sum + outcome.probability, 0) - 1) <
      1e-12,
  );
});

test("engine rejeita distribuição inválida", () => {
  assert.throws(
    () => battleRoundOutcomes(1, 1, [0.5, 0.5, 0.5, 0, 0, 0], alwaysOne),
    /Distribuição de combate inválida/,
  );
});
