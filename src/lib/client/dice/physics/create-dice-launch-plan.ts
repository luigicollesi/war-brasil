import type {
  DiceLaunchPlan,
  DiceQuaternion,
  DiceVector3,
} from "../types";

const UINT32_RANGE = 0x1_0000_0000;
const FALLBACK_SEED = 0x6d2b79f5;
const ZERO_OFFSET: DiceVector3 = [0, 0, 0];
const DICE_LAUNCH_HEIGHT = 20;
const DICE_CAMERA_CLEARANCE = 0.7;

function validateDicePhysicsSeed(seed: string) {
  if (!seed.trim()) {
    throw new Error("seed dos dados não pode ser vazio");
  }
  return seed;
}

function validateLaunchOffset(offset: DiceVector3) {
  if (offset.some((component) => !Number.isFinite(component))) {
    throw new Error("A origem física dos dados precisa conter valores finitos.");
  }
  return offset;
}

function hashSeed(seed: string) {
  validateDicePhysicsSeed(seed);

  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0) || FALLBACK_SEED;
}

function createUnitRandom(seed: string) {
  let state = hashSeed(seed);

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / UINT32_RANGE;
  };
}

function signed(next: () => number, magnitude = 1) {
  return (next() * 2 - 1) * magnitude;
}

function randomQuaternion(next: () => number): DiceQuaternion {
  let x = signed(next);
  let y = signed(next);
  let z = signed(next);
  let w = signed(next);
  const length = Math.sqrt(x * x + y * y + z * z + w * w);

  if (length < 1e-8) {
    return [0, 0, 0, 1];
  }

  x /= length;
  y /= length;
  z /= length;
  w /= length;
  return [x, y, z, w];
}

function baseXPositions(count: number) {
  if (count === 1) return [0];
  if (count === 2) return [-0.68, 0.68];
  return [-1.15, 0, 1.15];
}

export function validateDicePhysicsCount(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 3) {
    throw new Error("A física dos dados exige entre 1 e 3 dados.");
  }
  return count;
}

export function createDiceLaunchPlan(
  count: number,
  seed: string,
  launchOffset: DiceVector3 = ZERO_OFFSET,
): DiceLaunchPlan {
  validateDicePhysicsCount(count);
  validateDicePhysicsSeed(seed);
  validateLaunchOffset(launchOffset);

  const composedSeed = `${seed}:${count}`;
  const next = createUnitRandom(composedSeed);
  const positions = baseXPositions(count);

  const dice = positions.map((baseX, index) => {
    const position: DiceVector3 = [
      baseX + signed(next, 0.055) + launchOffset[0],
      DICE_LAUNCH_HEIGHT -
        DICE_CAMERA_CLEARANCE -
        index * 0.2 -
        next() * 0.35 +
        launchOffset[1],
      signed(next, 0.28) + launchOffset[2],
    ];
    const linearVelocity: DiceVector3 = [
      -baseX * 0.42 + signed(next, 0.24),
      -0.1 - next() * 0.28,
      signed(next, 0.52),
    ];
    const angularVelocity: DiceVector3 = [
      signed(next, 7.5),
      signed(next, 8.5),
      signed(next, 7.5),
    ];

    return {
      id: `${seed}:${index}`,
      index,
      position,
      rotation: randomQuaternion(next),
      linearVelocity,
      angularVelocity,
    };
  });

  return {
    key: `${count}:${hashSeed(composedSeed).toString(16)}:${launchOffset.join(",")}`,
    seed,
    count,
    dice,
  };
}
