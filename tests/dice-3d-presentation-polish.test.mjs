import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { battleDiceLaunchOffset } from "../.test-build/client/dice/battle-dice-layout.js";
import { createCameraFacingDockQuaternion } from "../.test-build/client/dice/animation/camera-facing-dock.js";
import { DICE_FACE_DEFINITIONS } from "../.test-build/client/dice/geometry/dice-faces.js";
import { createDiceLaunchPlan } from "../.test-build/client/dice/physics/create-dice-launch-plan.js";
import {
  createVisualFaceRemap,
  rotateDiceVectorByQuaternion,
} from "../.test-build/client/dice/physics/visual-face-remap.js";

function approximatelyEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Esperado ${actual} ≈ ${expected}`,
  );
}

function normalizedDirection(from, to) {
  const vector = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const length = Math.hypot(...vector);
  return vector.map((component) => component / length);
}

test("ataque e defesa usam origens físicas separadas sem mudar o lançamento determinístico", () => {
  const attackOffset = battleDiceLaunchOffset("attack");
  const defenseOffset = battleDiceLaunchOffset("defense");
  const seed = "battle-separated-zones";
  const attack = createDiceLaunchPlan(3, seed, attackOffset);
  const defense = createDiceLaunchPlan(3, seed, defenseOffset);

  assert.ok(defenseOffset[0] - attackOffset[0] >= 1.8);
  assert.equal(attack.dice.length, defense.dice.length);

  for (let index = 0; index < attack.dice.length; index += 1) {
    const attackDie = attack.dice[index];
    const defenseDie = defense.dice[index];

    approximatelyEqual(
      defenseDie.position[0] - attackDie.position[0],
      defenseOffset[0] - attackOffset[0],
    );
    approximatelyEqual(
      defenseDie.position[2] - attackDie.position[2],
      defenseOffset[2] - attackOffset[2],
    );
    assert.deepEqual(attackDie.rotation, defenseDie.rotation);
    assert.deepEqual(attackDie.linearVelocity, defenseDie.linearVelocity);
    assert.deepEqual(attackDie.angularVelocity, defenseDie.angularVelocity);
  }
});

test("dock orienta qualquer face física do resultado diretamente para a câmera", () => {
  const dockPosition = [-1.65, 0.08, 0.15];
  const cameraPosition = [0, 2.9, 6.3];
  const expectedDirection = normalizedDirection(dockPosition, cameraPosition);

  for (const face of DICE_FACE_DEFINITIONS) {
    const finalRotation = createVisualFaceRemap(face.value, 1);
    const dockRotation = createCameraFacingDockQuaternion(
      finalRotation,
      face.value,
      dockPosition,
      cameraPosition,
    );
    const visibleNormal = rotateDiceVectorByQuaternion(face.normal, dockRotation);

    for (let axis = 0; axis < 3; axis += 1) {
      approximatelyEqual(visibleNormal[axis], expectedDirection[axis], 1e-5);
    }
    approximatelyEqual(Math.hypot(...dockRotation), 1, 1e-6);
  }
});

test("apresentação usa cor oficial da facção e acabamento físico no corpo dourado", () => {
  const arena = readFileSync(
    "src/components/dice-3d/battle-dice-arena.tsx",
    "utf8",
  );
  const cinematic = readFileSync(
    "src/components/dice-3d/battle-dice-cinematic.tsx",
    "utf8",
  );
  const staticResults = readFileSync(
    "src/components/battle-static-dice-results.tsx",
    "utf8",
  );
  const visual = readFileSync("src/components/dice-3d/die-visual.tsx", "utf8");
  const palette = readFileSync("src/lib/client/player-color.ts", "utf8");

  assert.match(arena, /pipColor: playerColorHex\(attackerColor\)/);
  assert.match(arena, /pipColor: playerColorHex\(defenderColor\)/);
  assert.match(palette, /PLAYER_COLORS\.map/);
  assert.match(visual, /DICE_BODY_GOLD = "#d0ad5a"/);
  assert.match(visual, /meshPhysicalMaterial/);
  assert.match(visual, /clearcoat=\{0\.38\}/);
  assert.match(visual, /clearcoatRoughness=\{0\.3\}/);
  assert.doesNotMatch(visual, /color="#e8e3d8"/);

  assert.match(cinematic, /MAX_DICE_TEXTURE_ANISOTROPY = 8/);
  assert.match(cinematic, /gl\.capabilities\.getMaxAnisotropy\(\)/);
  assert.match(cinematic, /texture\.anisotropy = anisotropy/);
  assert.match(cinematic, /texture\.needsUpdate = true/);

  assert.match(staticResults, /preloadDiceAssets/);
  assert.match(staticResults, /skin: "attack"/);
  assert.match(staticResults, /skin: "defense"/);
  assert.match(staticResults, /pipColor: playerColorHex\(attackerColor\)/);
  assert.match(staticResults, /pipColor: playerColorHex\(defenderColor\)/);
});
