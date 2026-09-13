"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Group, MathUtils } from "three";
import { COMMAND_FOUNDATION_TOKENS } from "./foundation-tokens";
import type { NormalizedCommandSceneIntent } from "./scene-contract";

type Position3 = [number, number, number];

type ProfileOrbAssemblyProps = {
  intent: NormalizedCommandSceneIntent;
  reducedMotion: boolean;
  position: Position3;
  scale: number;
};

const ORBIT_A_FINAL: Position3 = [0.62, 0.18, 0.12];
const ORBIT_B_FINAL: Position3 = [-0.48, 0.56, -0.14];
const ORBIT_C_FINAL: Position3 = [1.02, -0.22, 0.34];

export function ProfileOrbAssembly({
  intent,
  reducedMotion,
  position,
  scale,
}: ProfileOrbAssemblyProps) {
  const rootRef = useRef<Group>(null);
  const orbitARef = useRef<Group>(null);
  const orbitBRef = useRef<Group>(null);
  const orbitCRef = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const emphasized = intent.mode === "profile" || intent.focus === "insignia";
  const targetScale = scale * (emphasized ? 1 : 0.72);
  const openingActive =
    intent.mode === "entrance" &&
    !reducedMotion &&
    intent.entranceState !== "settled";
  const initialScale = openingActive ? 0.001 : targetScale;

  useEffect(() => {
    if (!reducedMotion || !rootRef.current) return;
    rootRef.current.scale.setScalar(targetScale);
    if (orbitARef.current) orbitARef.current.rotation.set(...ORBIT_A_FINAL);
    if (orbitBRef.current) orbitBRef.current.rotation.set(...ORBIT_B_FINAL);
    if (orbitCRef.current) orbitCRef.current.rotation.set(...ORBIT_C_FINAL);
    invalidate();
  }, [invalidate, reducedMotion, targetScale]);

  useFrame((_, delta) => {
    const root = rootRef.current;
    if (!root || reducedMotion || openingActive) return;

    const nextScale = MathUtils.damp(
      root.scale.x,
      targetScale,
      COMMAND_FOUNDATION_TOKENS.motion.objectDamping,
      delta,
    );
    root.scale.setScalar(nextScale);

    if (orbitARef.current) {
      orbitARef.current.rotation.y += delta * 0.2;
      orbitARef.current.rotation.z += delta * 0.07;
    }
    if (orbitBRef.current) {
      orbitBRef.current.rotation.x -= delta * 0.14;
      orbitBRef.current.rotation.z += delta * 0.11;
    }
    if (orbitCRef.current) {
      orbitCRef.current.rotation.y -= delta * 0.09;
      orbitCRef.current.rotation.z -= delta * 0.13;
    }
  });

  return (
    <group
      ref={rootRef}
      name="CommandInsignia"
      position={position}
      scale={initialScale}
      userData={{ openingFinalScale: targetScale }}
    >
      <group name="ProfileOrbAssembly">
        <mesh name="ProfileOrb-Core" renderOrder={4}>
          <sphereGeometry args={[0.58, 48, 32]} />
          <meshPhysicalMaterial
            color="#315a43"
            roughness={0.28}
            metalness={0.05}
            transmission={0.7}
            thickness={0.34}
            ior={1.33}
            clearcoat={0.42}
            clearcoatRoughness={0.22}
          />
        </mesh>

        <mesh scale={0.88} renderOrder={5}>
          <sphereGeometry args={[0.58, 32, 20]} />
          <meshBasicMaterial
            color="#8cad82"
            transparent
            opacity={0.08}
            depthWrite={false}
          />
        </mesh>

        <mesh scale={1.025} renderOrder={5}>
          <sphereGeometry args={[0.58, 32, 20]} />
          <meshBasicMaterial
            color="#c9a459"
            wireframe
            transparent
            opacity={0.075}
            depthWrite={false}
          />
        </mesh>

        <group ref={orbitARef} name="ProfileOrb-OrbitA" rotation={ORBIT_A_FINAL}>
          <mesh renderOrder={6}>
            <torusGeometry args={[0.78, 0.012, 8, 96]} />
            <meshBasicMaterial
              color="#d0aa57"
              transparent
              opacity={0.38}
              depthWrite={false}
            />
          </mesh>
        </group>

        <group ref={orbitBRef} name="ProfileOrb-OrbitB" rotation={ORBIT_B_FINAL}>
          <mesh renderOrder={6}>
            <torusGeometry args={[0.91, 0.009, 8, 96]} />
            <meshBasicMaterial
              color="#9d793b"
              transparent
              opacity={0.25}
              depthWrite={false}
            />
          </mesh>
        </group>

        <group ref={orbitCRef} name="ProfileOrb-OrbitC" rotation={ORBIT_C_FINAL}>
          <mesh renderOrder={6}>
            <torusGeometry args={[1.02, 0.007, 8, 96]} />
            <meshBasicMaterial
              color="#d0aa57"
              transparent
              opacity={0.14}
              depthWrite={false}
            />
          </mesh>
        </group>

        <group name="ProfileOrb-Glyph" position={[0, 0, 0.48]} renderOrder={7}>
          <mesh position={[-0.085, 0.035, 0]}>
            <boxGeometry args={[0.085, 0.43, 0.045]} />
            <meshStandardMaterial
              color="#d7ad54"
              emissive="#6e501a"
              emissiveIntensity={0.18}
              metalness={0.62}
              roughness={0.32}
            />
          </mesh>
          <mesh position={[0.035, -0.145, 0]}>
            <boxGeometry args={[0.325, 0.085, 0.045]} />
            <meshStandardMaterial
              color="#d7ad54"
              emissive="#6e501a"
              emissiveIntensity={0.18}
              metalness={0.62}
              roughness={0.32}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
