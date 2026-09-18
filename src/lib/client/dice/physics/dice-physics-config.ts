import type { DiceVector3 } from "../types";
import { diceVisualGeometry } from "../visual-config";

export type DicePhysicsConfig = {
  timeStep: number;
  gravity: DiceVector3;
  dieSize: number;
  dieRadius: number;
  dieSegments: number;
  colliderHalfExtent: number;
  colliderBorderRadius: number;
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
  maxSimulationSteps: number;
};

const DICE_GAME_VISUAL_GEOMETRY = diceVisualGeometry(1);

export const DICE_PHYSICS: DicePhysicsConfig = {
  timeStep: 1 / 60,
  gravity: [0, -18, 0],
  dieSize: DICE_GAME_VISUAL_GEOMETRY.size,
  dieRadius: DICE_GAME_VISUAL_GEOMETRY.radius,
  dieSegments: DICE_GAME_VISUAL_GEOMETRY.segments,
  colliderHalfExtent: 0.455,
  colliderBorderRadius: 0.07,
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
  wallHalfHeight: 3,
  maxSimulationSteps: 480,
};

export const DICE_COLLIDER_INNER_HALF_EXTENT =
  DICE_PHYSICS.colliderHalfExtent - DICE_PHYSICS.colliderBorderRadius;

if (
  DICE_PHYSICS.colliderBorderRadius <= 0 ||
  DICE_COLLIDER_INNER_HALF_EXTENT <= 0
) {
  throw new Error("O collider arredondado dos dados precisa ter dimensões positivas.");
}
