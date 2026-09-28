"use client";

export function CollectionShowcaseAtmosphere() {
  return (
    <group name="CollectionShowcaseRearLighting" position={[0, 0.16, -1.62]}>
      <pointLight
        color="#dfb45a"
        intensity={11}
        distance={5.2}
        decay={2}
        position={[0, 0.05, 0.12]}
      />
    </group>
  );
}
