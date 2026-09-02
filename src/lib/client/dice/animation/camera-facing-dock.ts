import { Quaternion, Vector3 } from "three";
import { diceFaceDefinition } from "../geometry/dice-faces";
import type {
  DiceQuaternion,
  DiceValue,
  DiceVector3,
} from "../types";

function normalizedDirection(from: DiceVector3, to: DiceVector3) {
  const direction = new Vector3(...to).sub(new Vector3(...from));
  if (direction.lengthSq() < 1e-10) {
    throw new Error("A câmera precisa estar afastada da posição final do dado.");
  }
  return direction.normalize();
}

export function createCameraFacingDockQuaternion(
  finalRotation: DiceQuaternion,
  physicalTopValue: DiceValue,
  dockPosition: DiceVector3,
  cameraPosition: DiceVector3,
): DiceQuaternion {
  const finalQuaternion = new Quaternion(...finalRotation).normalize();
  const faceNormal = new Vector3(
    ...diceFaceDefinition(physicalTopValue).normal,
  )
    .applyQuaternion(finalQuaternion)
    .normalize();
  const cameraDirection = normalizedDirection(dockPosition, cameraPosition);
  const adjustment = new Quaternion().setFromUnitVectors(
    faceNormal,
    cameraDirection,
  );
  const result = adjustment.multiply(finalQuaternion).normalize();

  return [result.x, result.y, result.z, result.w];
}
