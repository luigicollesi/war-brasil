"use client";

import { useThree } from "@react-three/fiber";

const DESKTOP_PEDESTAL_X = -0.25;

export function StoreShowcasePedestal({
  mode,
}: {
  mode: "standard" | "collection";
}) {
  const pedestalX = useThree((state) =>
    state.size.width > 900 ? DESKTOP_PEDESTAL_X : 0,
  );

  if (mode === "collection") return null;

  return (
    <group name="StoreShowcasePedestal" position={[pedestalX, -1.45, 0]}>
      <mesh>
        <cylinderGeometry args={[1.72, 1.94, 0.22, 72]} />
        <meshStandardMaterial
          color="#151b18"
          roughness={0.46}
          metalness={0.62}
        />
      </mesh>
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.48, 1.7, 72]} />
        <meshStandardMaterial
          color="#d8ded8"
          emissive="#718077"
          emissiveIntensity={0.5}
          roughness={0.32}
          metalness={0.66}
        />
      </mesh>
      <pointLight
        color="#e6eee8"
        intensity={7}
        distance={4.8}
        position={[0, 0.8, 0]}
      />
    </group>
  );
}
