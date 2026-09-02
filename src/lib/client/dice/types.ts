import type { Texture } from "three";

export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;
export type DiceSkin = "neutral" | "attack" | "defense";
export type DiceVector3 = [number, number, number];
export type DiceEuler = [number, number, number];
export type DiceQuaternion = [number, number, number, number];

export type DiceFaceTextureSet = Readonly<Record<DiceValue, Texture>>;

export type RoundedDieGeometryOptions = {
  size?: number;
  radius?: number;
  segments?: number;
};

export type DiceTextureOptions = {
  skin: DiceSkin;
  pipColor?: string;
  resolution?: number;
};

export type DiceLaunchState = {
  id: string;
  index: number;
  position: DiceVector3;
  rotation: DiceQuaternion;
  linearVelocity: DiceVector3;
  angularVelocity: DiceVector3;
};

export type DiceLaunchPlan = {
  key: string;
  seed: string;
  count: number;
  dice: readonly DiceLaunchState[];
};

export type DiceSettledBodyState = {
  index: number;
  position: DiceVector3;
  rotation: DiceQuaternion;
  physicalTopValue: DiceValue;
};

export type DicePhysicsSettledHandler = (
  states: readonly DiceSettledBodyState[],
) => void;
