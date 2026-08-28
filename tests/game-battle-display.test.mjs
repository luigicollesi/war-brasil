import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildBattleDisplayDice } from "../.test-build/game-battle-display.js";
import { battleComparisonRows } from "../.test-build/game-battle-presentation.js";

function source(path) {
  return readFileSync(path, "utf8");
}

test("ordem visual embaralha dados sem alterar valores nem a entrada", () => {
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
  assert.deepEqual(
    [...display.map((die) => die.sourceIndex)].sort((a, b) => a - b),
    [0, 1, 2],
  );
});

test("mesmo resultado mantém ordem visual e perfis estáveis", () => {
  const args = {
    values: [6, 4, 2],
    side: "defense",
    seed: "20:35:6,4,2",
  };

  assert.deepEqual(buildBattleDisplayDice(args), buildBattleDisplayDice(args));
});

test("dados recebem velocidades controladas e sentidos variados", () => {
  const display = buildBattleDisplayDice({
    values: [6, 4, 2],
    side: "attack",
    seed: "animation-profile",
  });
  const directions = new Set(display.map((die) => die.animation.direction));

  assert.equal(directions.has(1), true);
  assert.equal(directions.has(-1), true);

  for (const die of display) {
    assert.ok(die.animation.durationMs >= 520);
    assert.ok(die.animation.durationMs <= 850);
    assert.ok(die.animation.rotations >= 2);
    assert.ok(die.animation.rotations <= 4);
    assert.ok(die.animation.delayMs >= 0);
    assert.ok(die.animation.delayMs <= 70);
  }
});

test("comparação lógica continua maior contra maior apesar da ordem visual", () => {
  const displayAttack = buildBattleDisplayDice({
    values: [6, 4, 2],
    side: "attack",
    seed: "comparison",
  });
  assert.notDeepEqual(displayAttack.map((die) => die.value), [6, 4, 2]);

  assert.deepEqual(
    battleComparisonRows({
      attacker: [6, 4, 2],
      defender: [5, 3, 1],
      attackMode: "normal",
    }).map((row) => [row.attackerDie, row.defenderDie]),
    [[6, 5], [4, 3], [2, 1]],
  );
});

test("overlay separa lado em rolagem e mantém dados em slots estáveis", () => {
  const overlay = source("src/components/battle-overlay.tsx");

  assert.match(overlay, /useState<BattleDisplaySide \| null>/);
  assert.match(overlay, /rollingSide === "attack"/);
  assert.match(overlay, /rollingSide === "defense"/);
  assert.match(overlay, /className="battle-die-slot"/);
  assert.match(overlay, /className="battle-die"/);
  assert.match(overlay, /rollAnimation=\{die\.animation\}/);
  assert.doesNotMatch(overlay, /Math\.random/);
});

test("layout quebra grupos no desktop e empilha ataque e defesa no celular", () => {
  const css = source("src/app/game/[roomId]/game-battle-dice-polish.css");

  assert.match(css, /\.battle-dice-grid\s*\{[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(css, /\.battle-modal\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.battle-dice-grid\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /--die-roll-duration/);
  assert.match(css, /--die-roll-delay/);
});
