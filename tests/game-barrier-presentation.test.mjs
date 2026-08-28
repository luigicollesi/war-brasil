import assert from "node:assert/strict";
import test from "node:test";
import {
  barrierAttackSummary,
  barrierManeuverSummary,
} from "../.test-build/game-barrier-presentation.js";

test("ataque por barreira mostra apenas nome e penalidade relevante", () => {
  assert.deepEqual(
    barrierAttackSummary({
      barrierName: "Serra da Mantiqueira",
      selectable: true,
      minimumTroops: 4,
      lossPerComparison: 3,
    }),
    {
      name: "Serra da Mantiqueira",
      detail: "Confronto perdido: −3 tropas",
      blocked: false,
    },
  );
});

test("ataque indisponível troca a penalidade pela ação necessária", () => {
  assert.deepEqual(
    barrierAttackSummary({
      barrierName: null,
      selectable: false,
      minimumTroops: 4,
    }),
    {
      name: "Barreira natural",
      detail: "Precisa de 4 tropas para atacar",
      blocked: true,
    },
  );
});

test("manobra por barreira comunica somente perda da travessia", () => {
  assert.deepEqual(
    barrierManeuverSummary({
      barrierName: "Rio X",
      selectable: true,
      minimumTroops: 2,
      troopLoss: 1,
    }),
    {
      name: "Rio X",
      detail: "Travessia: −1 tropa",
      blocked: false,
    },
  );
});
