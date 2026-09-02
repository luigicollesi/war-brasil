import { DICE_FACE_DEFINITIONS } from "../geometry/dice-faces";
import type { DiceQuaternion, DiceValue } from "../types";

function normalizeQuaternion(rotation: DiceQuaternion): DiceQuaternion {
  const [x, y, z, w] = rotation;
  const length = Math.sqrt(x * x + y * y + z * z + w * w);
  if (!Number.isFinite(length) || length < 1e-8) {
    throw new Error("Quaternion inválido para detectar a face superior do dado.");
  }
  return [x / length, y / length, z / length, w / length];
}

function rotatedNormalY(
  normal: readonly [number, number, number],
  rotation: DiceQuaternion,
) {
  const [nx, ny, nz] = normal;
  const [x, y, z, w] = rotation;

  return (
    2 * (x * y + z * w) * nx +
    (1 - 2 * (x * x + z * z)) * ny +
    2 * (y * z - x * w) * nz
  );
}

export function detectPhysicalTopFace(rotation: DiceQuaternion): DiceValue {
  const normalized = normalizeQuaternion(rotation);
  let topValue: DiceValue = 1;
  let topScore = Number.NEGATIVE_INFINITY;

  for (const face of DICE_FACE_DEFINITIONS) {
    const score = rotatedNormalY(face.normal, normalized);
    if (score > topScore) {
      topScore = score;
      topValue = face.value;
    }
  }

  return topValue;
}
