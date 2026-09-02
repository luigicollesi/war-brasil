import { diceFaceDefinition } from "../geometry/dice-faces";
import type {
  DiceQuaternion,
  DiceValue,
  DiceVector3,
} from "../types";

const QUATERNION_EPSILON = 1e-8;

function normalizeQuaternion(rotation: DiceQuaternion): DiceQuaternion {
  const [x, y, z, w] = rotation;
  const length = Math.hypot(x, y, z, w);
  if (!Number.isFinite(length) || length < QUATERNION_EPSILON) {
    throw new Error("Quaternion inválido para remapear a face do dado.");
  }
  return [x / length, y / length, z / length, w / length];
}

function cross(a: DiceVector3, b: DiceVector3): DiceVector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: DiceVector3, b: DiceVector3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function perpendicularCardinalAxis(vector: DiceVector3): DiceVector3 {
  if (Math.abs(vector[0]) < 0.5) return [1, 0, 0];
  return [0, 1, 0];
}

export function multiplyDiceQuaternions(
  left: DiceQuaternion,
  right: DiceQuaternion,
): DiceQuaternion {
  const [ax, ay, az, aw] = normalizeQuaternion(left);
  const [bx, by, bz, bw] = normalizeQuaternion(right);

  return normalizeQuaternion([
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]);
}

export function rotateDiceVectorByQuaternion(
  vector: DiceVector3,
  rotation: DiceQuaternion,
): DiceVector3 {
  const [x, y, z, w] = normalizeQuaternion(rotation);
  const [vx, vy, vz] = vector;

  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);

  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
}

/**
 * Returns a proper cube rotation for the visual child only.
 * The target face is rotated onto the local axis occupied by the physical
 * top face, so the rigid-body trajectory and collider remain untouched.
 */
export function createVisualFaceRemap(
  targetValue: DiceValue,
  physicalTopValue: DiceValue,
): DiceQuaternion {
  const targetNormal = diceFaceDefinition(targetValue).normal;
  const physicalNormal = diceFaceDefinition(physicalTopValue).normal;
  const alignment = dot(targetNormal, physicalNormal);

  if (alignment > 1 - QUATERNION_EPSILON) {
    return [0, 0, 0, 1];
  }

  if (alignment < -1 + QUATERNION_EPSILON) {
    const axis = perpendicularCardinalAxis(targetNormal);
    return [axis[0], axis[1], axis[2], 0];
  }

  const axis = cross(targetNormal, physicalNormal);
  return normalizeQuaternion([axis[0], axis[1], axis[2], 1 + alignment]);
}
