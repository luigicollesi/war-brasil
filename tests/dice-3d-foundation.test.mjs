import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRoundedDieGeometry } from "../.test-build/client/dice/geometry/create-rounded-die-geometry.js";
import { DICE_FACE_DEFINITIONS } from "../.test-build/client/dice/geometry/dice-faces.js";
import {
  DICE_PIP_LAYOUT_PERCENT,
  DICE_VALUES,
} from "../.test-build/client/dice/pip-layout.js";
import { validateDiceValues } from "../.test-build/client/dice/dice-values.js";
import {
  DICE_COLLIDER_INNER_HALF_EXTENT,
  DICE_PHYSICS,
} from "../.test-build/client/dice/physics/dice-physics-config.js";
import {
  createDiceLaunchPlan,
  validateDicePhysicsCount,
} from "../.test-build/client/dice/physics/create-dice-launch-plan.js";
import { detectPhysicalTopFace } from "../.test-build/client/dice/physics/detect-top-face.js";

function source(path) {
  return readFileSync(path, "utf8");
}

function approximatelyEqual(actual, expected, epsilon = 1e-5) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Esperado ${actual} ≈ ${expected}`,
  );
}

test("layout de pips cobre os seis valores com coordenadas válidas", () => {
  assert.deepEqual(DICE_VALUES, [1, 2, 3, 4, 5, 6]);

  for (const value of DICE_VALUES) {
    const pips = DICE_PIP_LAYOUT_PERCENT[value];
    assert.equal(pips.length, value);
    for (const [x, y] of pips) {
      assert.ok(x >= 0 && x <= 100);
      assert.ok(y >= 0 && y <= 100);
    }
  }
});

test("faces canônicas são únicas e preservam pares opostos de um D6", () => {
  assert.equal(DICE_FACE_DEFINITIONS.length, 6);
  assert.deepEqual(
    [...DICE_FACE_DEFINITIONS.map((face) => face.value)].sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6],
  );

  for (const face of DICE_FACE_DEFINITIONS) {
    assert.equal(face.value + face.opposite, 7);
    const opposite = DICE_FACE_DEFINITIONS.find(
      (candidate) => candidate.value === face.opposite,
    );
    assert.ok(opposite);
    for (let axis = 0; axis < 3; axis += 1) {
      approximatelyEqual(opposite.normal[axis], -face.normal[axis]);
    }
  }
});

test("validação aceita somente uma a três faces D6 válidas", () => {
  assert.deepEqual(validateDiceValues([1]), [1]);
  assert.deepEqual(validateDiceValues([6, 4, 2]), [6, 4, 2]);
  assert.throws(() => validateDiceValues([]), /entre 1 e 3/);
  assert.throws(() => validateDiceValues([1, 2, 3, 4]), /entre 1 e 3/);
  assert.throws(() => validateDiceValues([0]), /inválido/);
  assert.throws(() => validateDiceValues([7]), /inválido/);
  assert.throws(() => validateDiceValues([2.5]), /inválido/);
});

test("geometria procedural arredondada permanece finita, normalizada e dentro do cubo", () => {
  const geometry = createRoundedDieGeometry({
    size: 1,
    radius: 0.1,
    segments: 4,
  });
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");

  assert.ok(position.count > 24);
  assert.equal(position.count, normal.count);

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const nx = normal.getX(index);
    const ny = normal.getY(index);
    const nz = normal.getZ(index);

    for (const component of [x, y, z, nx, ny, nz]) {
      assert.equal(Number.isFinite(component), true);
    }
    assert.ok(Math.abs(x) <= 0.500001);
    assert.ok(Math.abs(y) <= 0.500001);
    assert.ok(Math.abs(z) <= 0.500001);
    approximatelyEqual(Math.hypot(nx, ny, nz), 1, 1e-4);
  }

  assert.ok(geometry.boundingBox);
  approximatelyEqual(geometry.boundingBox.min.x, -0.5);
  approximatelyEqual(geometry.boundingBox.min.y, -0.5);
  approximatelyEqual(geometry.boundingBox.min.z, -0.5);
  approximatelyEqual(geometry.boundingBox.max.x, 0.5);
  approximatelyEqual(geometry.boundingBox.max.y, 0.5);
  approximatelyEqual(geometry.boundingBox.max.z, 0.5);
  assert.deepEqual(geometry.userData.roundedDie, {
    size: 1,
    radius: 0.1,
    segments: 4,
  });

  geometry.dispose();
});

test("geometria rejeita parâmetros que produziriam um dado degenerado", () => {
  assert.throws(
    () => createRoundedDieGeometry({ size: 0 }),
    /size deve ser um número positivo/,
  );
  assert.throws(
    () => createRoundedDieGeometry({ size: 1, radius: 0.5 }),
    /radius deve estar entre 0 e metade/,
  );
  assert.throws(
    () => createRoundedDieGeometry({ segments: 1 }),
    /segments deve ser um inteiro maior ou igual a 2/,
  );
});

test("plano físico é determinístico, finito e mantém até três dados separados", () => {
  const first = createDiceLaunchPlan(3, "phase-2-quality");
  const repeat = createDiceLaunchPlan(3, "phase-2-quality");
  const other = createDiceLaunchPlan(3, "phase-2-other");

  assert.deepEqual(first, repeat);
  assert.notDeepEqual(first, other);
  assert.equal(first.dice.length, 3);

  for (const die of first.dice) {
    for (const component of [
      ...die.position,
      ...die.rotation,
      ...die.linearVelocity,
      ...die.angularVelocity,
    ]) {
      assert.equal(Number.isFinite(component), true);
    }
    approximatelyEqual(Math.hypot(...die.rotation), 1, 1e-8);
    assert.ok(die.position[1] > DICE_PHYSICS.floorTopY + DICE_PHYSICS.dieSize);
    assert.ok(Math.abs(die.position[0]) < DICE_PHYSICS.trayHalfWidth - 0.5);
  }

  for (let index = 1; index < first.dice.length; index += 1) {
    const previous = first.dice[index - 1].position[0];
    const current = first.dice[index].position[0];
    assert.ok(current - previous > DICE_PHYSICS.colliderHalfExtent * 2);
  }
});

test("collider arredondado preserva o mesmo envelope externo do cubo anterior", () => {
  assert.ok(DICE_PHYSICS.colliderBorderRadius > 0);
  assert.ok(DICE_COLLIDER_INNER_HALF_EXTENT > 0);
  approximatelyEqual(
    DICE_COLLIDER_INNER_HALF_EXTENT + DICE_PHYSICS.colliderBorderRadius,
    DICE_PHYSICS.colliderHalfExtent,
  );
  assert.ok(DICE_PHYSICS.colliderHalfExtent < DICE_PHYSICS.dieSize / 2);
});

test("física rejeita contagens e seeds inválidos antes de montar o mundo", () => {
  assert.equal(validateDicePhysicsCount(1), 1);
  assert.equal(validateDicePhysicsCount(3), 3);
  assert.throws(() => validateDicePhysicsCount(0), /entre 1 e 3/);
  assert.throws(() => validateDicePhysicsCount(4), /entre 1 e 3/);
  assert.throws(() => validateDicePhysicsCount(1.5), /entre 1 e 3/);
  assert.throws(() => createDiceLaunchPlan(1, "   "), /não pode ser vazio/);
});

test("detecção de repouso identifica faces físicas canônicas a partir do quaternion", () => {
  const halfSqrt = Math.SQRT1_2;
  assert.equal(detectPhysicalTopFace([0, 0, 0, 1]), 1);
  assert.equal(detectPhysicalTopFace([0, 0, halfSqrt, halfSqrt]), 2);
  assert.equal(detectPhysicalTopFace([0, 0, -halfSqrt, halfSqrt]), 5);
  assert.equal(detectPhysicalTopFace([-halfSqrt, 0, 0, halfSqrt]), 3);
  assert.equal(detectPhysicalTopFace([halfSqrt, 0, 0, halfSqrt]), 4);
  assert.equal(detectPhysicalTopFace([0, 0, 0, -3]), 1);
  assert.throws(
    () => detectPhysicalTopFace([0, 0, 0, 0]),
    /Quaternion inválido/,
  );
});

test("fundação 3D é client-side, procedural e mantém fallback 2D", () => {
  const gameDie = source("src/components/game-die.tsx");
  const scene = source("src/components/dice-3d/dice-scene.tsx");
  const die = source("src/components/dice-3d/die-3d.tsx");
  const visual = source("src/components/dice-3d/die-visual.tsx");
  const skins = source("src/lib/client/dice/textures/dice-skins.ts");

  assert.match(gameDie, /DICE_PIP_LAYOUT_PERCENT/);
  assert.doesNotMatch(gameDie, /const pipPositions/);

  assert.match(scene, /@react-three\/fiber/);
  assert.match(scene, /Dice2DFallback/);
  assert.match(scene, /getSharedRoundedDieGeometry/);
  assert.doesNotMatch(scene, /runGameCommand/);
  assert.doesNotMatch(scene, /Math\.random/);

  assert.match(die, /DieVisual/);
  assert.doesNotMatch(die, /useGLTF|\.glb/);
  assert.match(visual, /planeGeometry/);
  assert.match(visual, /DICE_FACE_DEFINITIONS/);

  assert.match(skins, /\/dado-brasil-hq\.svg/);
  assert.match(skins, /\/dado-ataque-vermelho-hq\.svg/);
  assert.match(skins, /\/dado-defesa-azul-hq\.svg/);
});

test("fase 2 usa um único mundo Rapier com passo fixo, collider arredondado e repouso agregado", () => {
  const packageJson = JSON.parse(source("package.json"));
  const stage = source("src/components/dice-3d/dice-physics-stage.tsx");
  const physicsDie = source("src/components/dice-3d/physics-die.tsx");
  const preSimulation = source("src/components/dice-3d/dice-pre-simulation.tsx");
  const tray = source("src/components/dice-3d/dice-tray.tsx");
  const launchPlan = source(
    "src/lib/client/dice/physics/create-dice-launch-plan.ts",
  );

  assert.equal(packageJson.dependencies["@react-three/rapier"], "2.2.0");
  assert.equal((stage.match(/<Physics\b/g) ?? []).length, 1);
  assert.match(stage, /timeStep=\{DICE_PHYSICS\.timeStep\}/);
  assert.match(stage, /updateLoop="independent"/);
  assert.match(stage, /sleepingBodies/);
  assert.match(stage, /detectPhysicalTopFace/);
  assert.doesNotMatch(stage, /runGameCommand|fetch\(|Math\.random/);

  assert.match(physicsDie, /RigidBody/);
  assert.match(physicsDie, /colliders=\{false\}/);
  assert.match(physicsDie, /RoundCuboidCollider/);
  assert.match(physicsDie, /DICE_COLLIDER_INNER_HALF_EXTENT/);
  assert.doesNotMatch(physicsDie, /<CuboidCollider/);
  assert.match(physicsDie, /onSleep=\{onSleep\}/);
  assert.match(physicsDie, /onWake=\{onWake\}/);
  assert.match(physicsDie, /\bccd\b/);

  assert.match(preSimulation, /RoundCuboidCollider/);
  assert.match(preSimulation, /DICE_COLLIDER_INNER_HALF_EXTENT/);
  assert.doesNotMatch(preSimulation, /<CuboidCollider/);

  assert.equal((tray.match(/<CuboidCollider\b/g) ?? []).length, 5);
  assert.doesNotMatch(launchPlan, /Math\.random/);
});
