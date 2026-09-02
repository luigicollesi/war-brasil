import type { DiceVector3 } from "../types";

export type DicePhysicsConfig = {
  timeStep: number;
  gravity: DiceVector3;
  dieSize: number;
  dieRadius: number;
  dieSegments: number;
  colliderHalfExtent: number;
  friction: number;
  restitution: number;
  contactSkin: number;
  linearDamping: number;
  angularDamping: number;
  additionalSolverIterations: number;
  trayHalfWidth: number;
  trayHalfDepth: number;
  floorTopY: number;
  floorHalfThickness: number;
  wallHalfThickness: number;
  wallHalfHeight: number;
};

export const DICE_PHYSICS: DicePhysicsConfig = {
  timeStep: 1 / 60,
  gravity: [0, -18, 0],
  dieSize: 1,
  dieRadius: 0.1,
  dieSegments: 8,
  colliderHalfExtent: 0.455,
  friction: 0.72,
  restitution: 0.3,
  contactSkin: 0.0025,
  linearDamping: 0.16,
  angularDamping: 0.2,
  additionalSolverIterations: 2,
  trayHalfWidth: 2.75,
  trayHalfDepth: 1.55,
  floorTopY: -0.58,
  floorHalfThickness: 0.08,
  wallHalfThickness: 0.08,
  wallHalfHeight: 2.2,
};
