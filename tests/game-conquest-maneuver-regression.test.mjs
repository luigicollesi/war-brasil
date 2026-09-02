import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { maneuverMovableTroops } from "../.test-build/game-rules.js";

test("tropas transferidas após conquista continuam disponíveis para manobra", () => {
  const conquest = readFileSync(
    "src/lib/server/game-conquest-command-service.ts",
    "utf8",
  );

  assert.match(conquest, /SET troops=\$3,moved_in_turn=0/);
  assert.doesNotMatch(conquest, /SET troops=\$3,moved_in_turn=\$3/);
  assert.equal(maneuverMovableTroops(4, 0), 3);
});

test("entrada na fase de manobra começa sem bloqueios herdados do ataque", () => {
  const phaseService = readFileSync(
    "src/lib/server/game-command-service.ts",
    "utf8",
  );
  const executePhaseActionStart = phaseService.indexOf(
    "export async function executePhaseAction",
  );
  const finishAttackStart = phaseService.indexOf(
    'if (input.action === "finishAttack")',
    executePhaseActionStart,
  );
  const finishAttackEnd = phaseService.indexOf(
    'if (input.action !== "endTurn")',
    finishAttackStart,
  );

  assert.ok(executePhaseActionStart >= 0);
  assert.ok(finishAttackStart >= 0);
  assert.ok(finishAttackEnd > finishAttackStart);

  const finishAttack = phaseService.slice(finishAttackStart, finishAttackEnd);
  assert.match(finishAttack, /SET moved_in_turn=0/);
  assert.match(finishAttack, /owner_player_id=\$2/);
  assert.match(finishAttack, /phase='maneuver'/);
  assert.ok(
    finishAttack.indexOf("SET moved_in_turn=0") <
      finishAttack.indexOf("phase='maneuver'"),
  );
});

test("somente tropas recebidas durante manobra entram no bloqueio moved_in_turn", () => {
  const maneuver = readFileSync(
    "src/lib/server/game-maneuver-command-service.ts",
    "utf8",
  );

  assert.match(
    maneuver,
    /SET troops=troops\+\$3,moved_in_turn=moved_in_turn\+\$3/,
  );
  assert.equal(maneuverMovableTroops(4, 3), 0);
});
