import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildBattleDisplayDice } from "../.test-build/game-battle-display.js";
import { battleComparisonRows } from "../.test-build/game-battle-presentation.js";

function source(path) {
  return readFileSync(path, "utf8");
}

test("ordem visual legado embaralha dados sem alterar valores nem a entrada", () => {
  const input = [6, 4, 2];
  const before = [...input];
  const display = buildBattleDisplayDice({
    values: input,
    side: "attack",
    seed: "20:35:6,4,2",
  });

  assert.deepEqual(input, before);
  assert.deepEqual(
    [...display.map((die) => die.value)].sort((a, b) => b - a),
    before,
  );
  assert.notDeepEqual(display.map((die) => die.value), before);
});

test("comparação lógica continua maior contra maior independentemente da apresentação", () => {
  assert.deepEqual(
    battleComparisonRows({
      attacker: [6, 4, 2],
      defender: [5, 3, 1],
      attackMode: "normal",
    }).map((row) => [row.attackerDie, row.defenderDie]),
    [[6, 5], [4, 3], [2, 1]],
  );
});

test("overlay usa arena 3D única e não renderiza mais slots 2D de combate", () => {
  const overlay = source("src/components/battle-overlay.tsx");
  const arena = source("src/components/dice-3d/battle-dice-arena.tsx");

  assert.match(overlay, /BattleDiceArena/);
  assert.match(overlay, /battle=\{battle\}/);
  assert.doesNotMatch(overlay, /buildBattleDisplayDice/);
  assert.doesNotMatch(overlay, /className="battle-die-slot"/);
  assert.doesNotMatch(overlay, /rollAnimation=/);
  assert.doesNotMatch(overlay, /Math\.random/);

  assert.equal((arena.match(/<Canvas\b/g) ?? []).length, 1);
  assert.match(arena, /skin: "attack"/);
  assert.match(arena, /skin: "defense"/);
  assert.match(arena, /stageStartedAt/);
  assert.match(arena, /battleDiceDockPositions/);
  assert.match(arena, /skipAnimation/);
  assert.doesNotMatch(arena, /runGameCommand|Math\.random/);
});

test("arena reserva palco responsivo e mantém resultados nas bordas inclusive no fallback", () => {
  const css = source("src/app/game/[roomId]/game-battle-dice-polish.css");

  assert.match(css, /\.battle-dice-arena\s*\{[\s\S]*?position:\s*relative/);
  assert.match(css, /\.battle-dice-arena\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.battle-dice-edge-label--attack\s*\{[\s\S]*?left:/);
  assert.match(css, /\.battle-dice-edge-label--defense\s*\{[\s\S]*?right:/);
  assert.match(css, /\.battle-dice-arena--fallback\s*\{[\s\S]*?grid-template-columns/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.battle-dice-arena\s*\{/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /battle-die-independent-roll/);
});
