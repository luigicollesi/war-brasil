import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controllerSource = readFileSync(
  new URL(
    "../src/components/phase-transition-confirmation-controller.tsx",
    import.meta.url,
  ),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../src/app/game/[roomId]/page.tsx", import.meta.url),
  "utf8",
);
const turnPanelSource = readFileSync(
  new URL("../src/components/game-turn-panel.tsx", import.meta.url),
  "utf8",
);

test("game page mounts phase transition confirmation without changing backend flow", () => {
  assert.match(pageSource, /PhaseTransitionConfirmationController/);
  assert.match(pageSource, /<PhaseTransitionConfirmationController \/>/);
  assert.doesNotMatch(controllerSource, /runGameCommand|fetch\(/);
});

test("attack and maneuver transition buttons are intercepted before their original click handlers", () => {
  assert.match(controllerSource, /"Ir para deslocamento": "finishAttack"/);
  assert.match(controllerSource, /"Encerrar turno": "endTurn"/);
  assert.match(controllerSource, /addEventListener\("click", onClickCapture, true\)/);
  assert.match(controllerSource, /event\.preventDefault\(\)/);
  assert.match(controllerSource, /event\.stopPropagation\(\)/);
});

test("confirmation replays the original button click exactly once", () => {
  assert.match(controllerSource, /bypassButtonRef\.current = button/);
  assert.match(controllerSource, /button\.click\(\)/);
  assert.match(
    controllerSource,
    /if \(bypassButtonRef\.current === button\)[\s\S]*?bypassButtonRef\.current = null/,
  );
});

test("attack confirmation clearly warns that attacks cannot resume", () => {
  assert.match(controllerSource, /title: "Encerrar ataques\?"/);
  assert.match(
    controllerSource,
    /Não será possível voltar a atacar neste turno\./,
  );
  assert.match(controllerSource, /cancelLabel: "Continuar atacando"/);
});

test("end turn confirmation warns that play passes to the next player", () => {
  assert.match(controllerSource, /title: "Encerrar turno\?"/);
  assert.match(
    controllerSource,
    /a vez passa para o próximo jogador\./,
  );
  assert.match(controllerSource, /cancelLabel: "Continuar deslocando"/);
});

test("existing phase commands remain authoritative in GameTurnPanel", () => {
  assert.match(
    turnPanelSource,
    /action\("phase", \{ action: "finishAttack" \}\)/,
  );
  assert.match(
    turnPanelSource,
    /action\("phase", \{ action: "endTurn" \}\)/,
  );
});
