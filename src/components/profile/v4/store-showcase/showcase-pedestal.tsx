"use client";

export function StoreShowcasePedestal({
  mode,
}: {
  mode: "standard" | "collection";
}) {
  const collection = mode === "collection";

  return (
    <group name="StoreShowcasePedestal" position={[0, -1.45, 0]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[1.72, 1.94, 0.22, 72]} />
        <meshStandardMaterial
          color={collection ? "#211c12" : "#151b18"}
          roughness={0.46}
          metalness={0.62}
        />
      </mesh>
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.48, 1.7, 72]} />
        <meshStandardMaterial
          color={collection ? "#d2a84f" : "#d8ded8"}
          emissive={collection ? "#8a5f16" : "#718077"}
          emissiveIntensity={collection ? 1.2 : 0.5}
          roughness={0.32}
          metalness={0.66}
        />
      </mesh>
      <pointLight
        color={collection ? "#d8ae56" : "#e6eee8"}
        intensity={collection ? 10 : 7}
        distance={4.8}
        position={[0, 0.8, 0]}
      />
    </group>
  );
}
