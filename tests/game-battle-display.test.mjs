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

test("overlay separa lançamento 3D fullscreen do resultado 2D estático", () => {
  const overlay = source("src/components/battle-overlay.tsx");
  const cinematic = source(
    "src/components/dice-3d/battle-dice-cinematic.tsx",
  );
  const fullscreen = source(
    "src/components/dice-3d/fullscreen-dice-cinematic.tsx",
  );
  const staticResults = source("src/components/battle-static-dice-results.tsx");

  assert.match(overlay, /BattleDiceCinematic/);
  assert.match(overlay, /BattleStaticDiceResults/);
  assert.doesNotMatch(overlay, /BattleDiceArena/);
  assert.doesNotMatch(overlay, /buildBattleDisplayDice/);
  assert.doesNotMatch(overlay, /className="battle-die-slot"/);
  assert.doesNotMatch(overlay, /rollAnimation=/);
  assert.doesNotMatch(overlay, /Math\.random/);

  assert.match(cinematic, /<FullscreenDiceCinematic/);
  assert.equal((fullscreen.match(/<Canvas\b/g) ?? []).length, 1);
  assert.match(fullscreen, /createPortal/);
  assert.match(cinematic, /stageStartedAt/);
  assert.match(fullscreen, /initialElapsedMs/);
  assert.doesNotMatch(cinematic, /battleDiceDockPositions|skipAnimation/);
  assert.doesNotMatch(cinematic, /runGameCommand|Math\.random/);

  assert.match(staticResults, /<GameDie/);
  assert.doesNotMatch(staticResults, /rolling=|rollAnimation=/);
});

test("cinematic fullscreen mantém palco leve, responsivo e sem interação", () => {
  const css = source(
    "src/components/dice-3d/battle-dice-cinematic.module.css",
  );
  const cinematic = source(
    "src/components/dice-3d/battle-dice-cinematic.tsx",
  );
  const fullscreen = source(
    "src/components/dice-3d/fullscreen-dice-cinematic.tsx",
  );

  assert.match(css, /\.root\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(css, /\.root\s*\{[\s\S]*?inset:\s*0/);
  assert.match(css, /\.root\s*\{[\s\S]*?touch-action:\s*none/);
  assert.match(css, /\.backdrop\s*\{[\s\S]*?rgba\(0, 0, 0, 0\.1\)/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(cinematic, /<FullscreenDiceCinematic/);
  assert.match(fullscreen, /PORTRAIT_ASPECT_THRESHOLD/);
  assert.match(fullscreen, /<perspectiveCamera/);
  assert.match(fullscreen, /CAMERA_HEIGHT = 20/);
  assert.match(fullscreen, /CAMERA_FOV = 50/);
  assert.match(fullscreen, /rotation=\{\[-Math\.PI \/ 2, 0, 0\]\}/);
  assert.match(fullscreen, /set\(\{ camera \}\)/);
  assert.doesNotMatch(fullscreen, /@react-three\/drei/);
  assert.match(fullscreen, /portrait \? Math\.PI \/ 2 : 0/);
  assert.match(fullscreen, /frameloop="demand"/);
});
