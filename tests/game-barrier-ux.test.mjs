import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  battleComparisonRows,
} from "../.test-build/game-battle-presentation.js";

function source(path) {
  return readFileSync(path, "utf8");
}

test("comparação visual preserva perda normal de uma tropa", () => {
  assert.deepEqual(
    battleComparisonRows({
      attacker: [4],
      defender: [5],
      attackMode: "normal",
    }),
    [
      {
        attackerDie: 4,
        defenderDie: 5,
        loser: "attacker",
        troopLoss: 1,
      },
    ],
  );
});

test("comparação visual de barreira mostra perda de três tropas", () => {
  assert.deepEqual(
    battleComparisonRows({
      attacker: [6, 4],
      defender: [5, 5],
      attackMode: "barrier",
    }),
    [
      {
        attackerDie: 6,
        defenderDie: 5,
        loser: "defender",
        troopLoss: 1,
      },
      {
        attackerDie: 4,
        defenderDie: 5,
        loser: "attacker",
        troopLoss: 3,
      },
    ],
  );
});

test("overlay de combate explica barreira e usa metadados persistidos", () => {
  const overlay = source("src/components/battle-overlay.tsx");

  assert.match(overlay, /BARRIER_ATTACK_DICE_BANDS/);
  assert.match(overlay, /battle\.barrierName/);
  assert.match(overlay, /attackerLossPerComparison/);
  assert.match(overlay, /ataque perde \$\{row\.troopLoss\}/);
  assert.match(overlay, /role="dialog"/);
  assert.match(overlay, /aria-modal="true"/);
  assert.match(overlay, /comparação perdida/);
});

test("modais de jogo prendem foco e permitem Escape somente quando canceláveis", () => {
  const modal = source("src/components/game-modal.tsx");

  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /previousFocus/);
  assert.match(modal, /onCloseRef\.current/);
});

test("manobra por barreira comunica saída, perda, chegada e CTA final", () => {
  const panel = source("src/components/game-turn-panel.tsx");

  assert.match(panel, /\{value\} saem/);
  assert.match(panel, /\{arriving\} chegam/);
  assert.match(panel, /Uma tropa será perdida durante a travessia/);
  assert.match(panel, /MOVER \$\{count\} · \$\{arriving\} CHEGAM/);
  assert.match(panel, /<GameModal/);
  assert.match(panel, /role="status"/);
});

test("mapa e cliente usam apenas o contrato enriquecido targetHints", () => {
  const client = source("src/components/game-client-v2.tsx");
  const board = source("src/components/interactive-board.tsx");

  assert.match(client, /targetHints=\{interaction\.mapHints\.targets\}/);
  assert.match(board, /targetHints: readonly MapTargetHint\[\]/);
  assert.doesNotMatch(board, /resolvedTargetHints/);
  assert.doesNotMatch(board, /targetTerritoryIds\?: readonly MapTargetHint/);
});

test("scope da interação invalida seleção quando rodada ou túnel mudam", () => {
  const interaction = source("src/lib/game-interaction.ts");

  assert.match(interaction, /snapshot\.room\.roundNumber/);
  assert.match(interaction, /snapshot\.room\.jurassicTunnelDestinationId/);
});
