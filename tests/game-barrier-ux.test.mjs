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

test("combate por barreira usa resumo contextual sem repetir tabela de regras", () => {
  const overlay = source("src/components/battle-overlay.tsx");

  assert.match(overlay, /GameModal/);
  assert.match(overlay, /barrierAttackSummary/);
  assert.match(overlay, /battle\.barrierName/);
  assert.match(overlay, /attackerLossPerComparison/);
  assert.match(overlay, /`Ataque −\$\{row\.troopLoss\}`/);
  assert.match(overlay, /battle-barrier-summary/);
  assert.doesNotMatch(overlay, /BARRIER_ATTACK_DICE_BANDS/);
  assert.doesNotMatch(overlay, /role="dialog"|aria-modal="true"/);
});

test("modais de jogo prendem foco e permitem Escape somente quando canceláveis", () => {
  const modal = source("src/components/game-modal.tsx");

  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /createPortal/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /previousFocus/);
  assert.match(modal, /onCloseRef\.current/);
});

test("manobra por barreira comunica saída, perda, chegada e CTA final sem duplicar aviso visual", () => {
  const panel = source("src/components/game-turn-panel.tsx");
  const css = source("src/app/game/[roomId]/game-ui-refresh.css");

  assert.match(panel, /\{value\} saem/);
  assert.match(panel, /\{arriving\} chegam/);
  assert.match(panel, /MOVER \$\{count\} · \$\{arriving\} CHEGAM/);
  assert.match(panel, /<GameModal/);
  assert.match(panel, /role="status"/);
  assert.match(css, /\.maneuver-barrier-summary\s*\{[\s\S]*?display:\s*none\s*!important/);
  assert.match(css, /\.troop-flow-center--barrier/);
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
  const interaction = source("src/lib/shared/game-interaction.ts");

  assert.match(interaction, /snapshot\.room\.roundNumber/);
  assert.match(interaction, /snapshot\.room\.jurassicTunnelDestinationId/);
});
