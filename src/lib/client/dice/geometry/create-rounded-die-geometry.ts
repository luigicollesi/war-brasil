import {
  BoxGeometry,
  type BufferAttribute,
  type BufferGeometry,
} from "three";
import type { RoundedDieGeometryOptions } from "../types";

const DEFAULT_SIZE = 1;
const DEFAULT_RADIUS = 0.1;
const DEFAULT_SEGMENTS = 8;
const EPSILON = 1e-8;

function positiveFinite(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} deve ser um número positivo.`);
  }
  return value;
}

export function createRoundedDieGeometry(
  options: RoundedDieGeometryOptions = {},
): BufferGeometry {
  const size = positiveFinite(options.size ?? DEFAULT_SIZE, "size");
  const radius = options.radius ?? DEFAULT_RADIUS;
  const segments = options.segments ?? DEFAULT_SEGMENTS;

  if (!Number.isFinite(radius) || radius < 0 || radius >= size / 2) {
    throw new Error("radius deve estar entre 0 e metade do tamanho do dado.");
  }
  if (!Number.isInteger(segments) || segments < 2) {
    throw new Error("segments deve ser um inteiro maior ou igual a 2.");
  }

  const geometry = new BoxGeometry(
    size,
    size,
    size,
    segments,
    segments,
    segments,
  );

  if (radius === 0) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  const position = geometry.getAttribute("position") as BufferAttribute;
  const normal = geometry.getAttribute("normal") as BufferAttribute;
  const half = size / 2;
  const innerExtent = half - radius;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);

    const innerX = Math.max(-innerExtent, Math.min(innerExtent, x));
    const innerY = Math.max(-innerExtent, Math.min(innerExtent, y));
    const innerZ = Math.max(-innerExtent, Math.min(innerExtent, z));

    const deltaX = x - innerX;
    const deltaY = y - innerY;
    const deltaZ = z - innerZ;
    const deltaLength = Math.hypot(deltaX, deltaY, deltaZ);

    if (deltaLength <= EPSILON) continue;

    const normalX = deltaX / deltaLength;
    const normalY = deltaY / deltaLength;
    const normalZ = deltaZ / deltaLength;

    position.setXYZ(
      index,
      innerX + normalX * radius,
      innerY + normalY * radius,
      innerZ + normalZ * radius,
    );
    normal.setXYZ(index, normalX, normalY, normalZ);
  }

  position.needsUpdate = true;
  normal.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.roundedDie = { size, radius, segments };

  return geometry;
}

export const DEFAULT_ROUNDED_DIE_GEOMETRY = {
  size: DEFAULT_SIZE,
  radius: DEFAULT_RADIUS,
  segments: DEFAULT_SEGMENTS,
} as const;
