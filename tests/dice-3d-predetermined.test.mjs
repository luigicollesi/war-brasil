import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DICE_FACE_DEFINITIONS } from "../.test-build/client/dice/geometry/dice-faces.js";
import { buildPredeterminedDiceRoll } from "../.test-build/client/dice/physics/build-predetermined-roll.js";
import { detectPhysicalTopFace } from "../.test-build/client/dice/physics/detect-top-face.js";
import { DICE_PHYSICS } from "../.test-build/client/dice/physics/dice-physics-config.js";
import {
  createVisualFaceRemap,
  multiplyDiceQuaternions,
  rotateDiceVectorByQuaternion,
} from "../.test-build/client/dice/physics/visual-face-remap.js";

function source(path) {
  return readFileSync(path, "utf8");
}

function approximatelyEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Esperado ${actual} ≈ ${expected}`,
  );
}

test("remapeamento visual cobre todos os 36 pares sem alterar o corpo físico", () => {
  for (const physicalFace of DICE_FACE_DEFINITIONS) {
    const bodyRotation = createVisualFaceRemap(physicalFace.value, 1);
    assert.equal(detectPhysicalTopFace(bodyRotation), physicalFace.value);

    for (const targetFace of DICE_FACE_DEFINITIONS) {
      const visualRotation = createVisualFaceRemap(
        targetFace.value,
        physicalFace.value,
      );
      const remappedTargetNormal = rotateDiceVectorByQuaternion(
        targetFace.normal,
        visualRotation,
      );

      for (let axis = 0; axis < 3; axis += 1) {
        approximatelyEqual(
          remappedTargetNormal[axis],
          physicalFace.normal[axis],
        );
      }
      approximatelyEqual(Math.hypot(...visualRotation), 1);

      const visibleWorldRotation = multiplyDiceQuaternions(
        bodyRotation,
        visualRotation,
      );
      assert.equal(
        detectPhysicalTopFace(visibleWorldRotation),
        targetFace.value,
        `Face física ${physicalFace.value} deveria mostrar ${targetFace.value}`,
      );
    }
  }
});

test("valores autoritativos remapeiam somente o visual e preservam a mesma trajetória", () => {
  const secondBodyRotation = createVisualFaceRemap(2, 1);
  const trajectory = {
    seed: "phase-3-invariant",
    timeStep: DICE_PHYSICS.timeStep,
    frames: [
      {
        step: 0,
        dice: [
          { index: 0, position: [0, 2, 0], rotation: [0, 0, 0, 1] },
          { index: 1, position: [1, 2, 0], rotation: secondBodyRotation },
        ],
      },
      {
        step: 120,
        dice: [
          { index: 0, position: [0, 0, 0], rotation: [0, 0, 0, 1] },
          { index: 1, position: [1, 0, 0], rotation: secondBodyRotation },
        ],
      },
    ],
    settled: [
      {
        index: 0,
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        physicalTopValue: 1,
      },
      {
        index: 1,
        position: [1, 0, 0],
        rotation: secondBodyRotation,
        physicalTopValue: 2,
      },
    ],
  };

  const first = buildPredeterminedDiceRoll([6, 5], trajectory);
  const second = buildPredeterminedDiceRoll([1, 3], trajectory);

  assert.equal(first.trajectory, trajectory);
  assert.equal(second.trajectory, trajectory);
  assert.deepEqual(first.trajectory.frames, second.trajectory.frames);
  assert.notDeepEqual(first.visualRemaps, second.visualRemaps);

  for (const roll of [first, second]) {
    for (const remap of roll.visualRemaps) {
      const physicalRotation = trajectory.settled[remap.index].rotation;
      const visibleRotation = multiplyDiceQuaternions(
        physicalRotation,
        remap.rotation,
      );
      assert.equal(detectPhysicalTopFace(visibleRotation), remap.targetValue);
    }
  }
});

test("plano predeterminado rejeita trajetórias incompletas ou inconsistentes", () => {
  assert.throws(
    () =>
      buildPredeterminedDiceRoll([1], {
        seed: "short",
        timeStep: DICE_PHYSICS.timeStep,
        frames: [
          {
            step: 0,
            dice: [{ index: 0, position: [0, 0, 0], rotation: [0, 0, 0, 1] }],
          },
        ],
        settled: [
          {
            index: 0,
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            physicalTopValue: 1,
          },
        ],
      }),
    /movimento físico/,
  );

  assert.throws(
    () =>
      buildPredeterminedDiceRoll([1, 2], {
        seed: "count",
        timeStep: DICE_PHYSICS.timeStep,
        frames: [
          { step: 0, dice: [] },
          { step: 1, dice: [] },
        ],
        settled: [
          {
            index: 0,
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            physicalTopValue: 1,
          },
        ],
      }),
    /quantidade de dados/,
  );
});

test("fase 3 pré-simula conjuntamente sem receber os resultados desejados", () => {
  const preSimulation = source("src/components/dice-3d/dice-pre-simulation.tsx");
  const stage = source("src/components/dice-3d/predetermined-dice-stage.tsx");

  assert.match(preSimulation, /<Physics/);
  assert.match(preSimulation, /\bpaused\b/);
  assert.match(preSimulation, /interpolate=\{false\}/);
  assert.match(preSimulation, /step\(DICE_PHYSICS\.timeStep\)/);
  assert.match(preSimulation, /body\.isSleeping\(\)/);
  assert.match(preSimulation, /maxSimulationSteps/);
  assert.match(preSimulation, /<DiceTray showSurface=\{false\}/);
  assert.doesNotMatch(preSimulation, /Math\.random|runGameCommand|fetch\(/);
  assert.doesNotMatch(preSimulation, /targetValue|targetValues/);

  assert.match(stage, /buildPredeterminedDiceRoll\(values, trajectory\)/);
  assert.match(stage, /<DicePreSimulation/);
  assert.match(stage, /count=\{values\.length\}/);
  assert.doesNotMatch(stage, /runGameCommand|fetch\(|Math\.random/);
});

test("replay usa a trajetória gravada e mantém remapeamento no filho visual desde o início", () => {
  const replay = source("src/components/dice-3d/dice-trajectory-replay.tsx");
  const scene = source("src/components/dice-3d/dice-scene.tsx");

  assert.match(replay, /useFrame/);
  assert.match(replay, /slerpQuaternions/);
  assert.match(replay, /lerpVectors/);
  assert.match(replay, /<group quaternion=\{remap\.rotation\}>/);
  assert.doesNotMatch(replay, /useState/);
  assert.doesNotMatch(replay, /RigidBody|Physics|setRotation|setTranslation/);

  assert.match(scene, /PredeterminedDiceStage/);
  assert.match(scene, /animationSeed\?: string/);
  assert.match(scene, /frameloop="demand"/);
  assert.match(scene, /Dice2DFallback/);
});
