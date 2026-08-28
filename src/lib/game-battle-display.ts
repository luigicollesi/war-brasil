export type BattleDisplaySide = "attack" | "defense";

export type DieRollAnimation = {
  direction: 1 | -1;
  durationMs: number;
  rotations: number;
  delayMs: number;
};

export type BattleDisplayDie = {
  value: number;
  sourceIndex: number;
  animation: DieRollAnimation;
};

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededNumber(seed: string, offset: number) {
  let value = hashString(`${seed}:${offset}`) || 1;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0xffffffff;
}

function stablePermutation(length: number, seed: string) {
  const indexes = Array.from({ length }, (_, index) => index);

  for (let index = length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(seededNumber(seed, index) * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }

  if (length > 1 && indexes.every((value, index) => value === index)) {
    indexes.push(indexes.shift() as number);
  }

  return indexes;
}

function animationProfile(seed: string, sourceIndex: number): DieRollAnimation {
  const direction = seededNumber(seed, sourceIndex * 4) >= 0.5 ? 1 : -1;
  const durationMs = Math.round(520 + seededNumber(seed, sourceIndex * 4 + 1) * 330);
  const rotations = 2 + Math.floor(seededNumber(seed, sourceIndex * 4 + 2) * 3);
  const delayMs = Math.round(seededNumber(seed, sourceIndex * 4 + 3) * 70);

  return { direction, durationMs, rotations, delayMs };
}

export function buildBattleDisplayDice({
  values,
  side,
  seed,
}: {
  values: readonly number[];
  side: BattleDisplaySide;
  seed: string;
}): BattleDisplayDie[] {
  const permutation = stablePermutation(values.length, `${seed}:${side}:order`);
  const animationSeed = `${seed}:${side}:animation`;

  return permutation.map((sourceIndex) => ({
    value: values[sourceIndex],
    sourceIndex,
    animation: animationProfile(animationSeed, sourceIndex),
  }));
}
