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
    for (let index = 0; index < face.normal.length; index += 1) {
      approximatelyEqual(opposite.normal[index], -face.normal[index]);
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

test("fundação 3D é client-side, procedural e mantém fallback 2D", () => {
  const gameDie = source("src/components/game-die.tsx");
  const scene = source("src/components/dice-3d/dice-scene.tsx");
  const die = source("src/components/dice-3d/die-3d.tsx");
  const skins = source("src/lib/client/dice/textures/dice-skins.ts");

  assert.match(gameDie, /DICE_PIP_LAYOUT_PERCENT/);
  assert.doesNotMatch(gameDie, /const pipPositions/);

  assert.match(scene, /@react-three\/fiber/);
  assert.match(scene, /Dice2DFallback/);
  assert.match(scene, /getSharedRoundedDieGeometry/);
  assert.doesNotMatch(scene, /runGameCommand/);
  assert.doesNotMatch(scene, /Math\.random/);

  assert.match(die, /planeGeometry/);
  assert.match(die, /DICE_FACE_DEFINITIONS/);
  assert.doesNotMatch(die, /useGLTF|\.glb/);

  assert.match(skins, /\/dado-brasil-hq\.svg/);
  assert.match(skins, /\/dado-ataque-vermelho-hq\.svg/);
  assert.match(skins, /\/dado-defesa-azul-hq\.svg/);
});
