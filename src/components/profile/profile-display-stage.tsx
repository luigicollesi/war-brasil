"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { Group } from "three";
import type { PublicProfileArsenal } from "@/src/lib/profile/profile-command-contract";
import { DiceShowcaseModel } from "./v4/store-showcase/dice-showcase-model";
import { TerritoryShowcaseModel } from "./v4/store-showcase/territory-showcase-model";
import styles from "./profile-display-stage.module.css";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}

function RotatingObject({
  children,
  position,
  scale,
  reducedMotion,
  baseRotation,
}: {
  children: ReactNode;
  position: [number, number, number];
  scale: number;
  reducedMotion: boolean;
  baseRotation: [number, number, number];
}) {
  const ref = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    const group = ref.current;
    if (!group || reducedMotion) return;
    group.rotation.y += delta * (hovered ? 0.48 : 0.16);
    const target = scale * (hovered ? 1.08 : 1);
    const nextScale = group.scale.x + (target - group.scale.x) * 0.08;
    group.scale.setScalar(nextScale);
  });

  return (
    <group
      ref={ref}
      position={position}
      scale={scale}
      rotation={baseRotation}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {children}
    </group>
  );
}

function ProfileStageScene({
  arsenal,
  reducedMotion,
}: {
  arsenal: PublicProfileArsenal;
  reducedMotion: boolean;
}) {
  const compact = useThree((state) => state.size.width <= 720);
  const diceScale = compact ? 0.92 : 1.05;
  const territoryScale = compact ? 0.62 : 0.74;

  const positions = compact
    ? {
        attack: [-1.55, 1.05, 0] as [number, number, number],
        defense: [1.55, 1.05, 0] as [number, number, number],
        neutral: [-1.55, -1.55, 0] as [number, number, number],
        territory: [1.55, -1.5, 0] as [number, number, number],
      }
    : {
        attack: [-4.35, 0, 0] as [number, number, number],
        defense: [-1.45, 0, 0] as [number, number, number],
        neutral: [1.45, 0, 0] as [number, number, number],
        territory: [4.4, 0, 0] as [number, number, number],
      };

  return (
    <>
      <ambientLight intensity={1.65} />
      <directionalLight position={[-5, 7, 8]} intensity={3.1} />
      <directionalLight position={[5, 3, 5]} intensity={1.4} />
      <pointLight position={[0, -1, 5]} intensity={2.4} distance={12} />
      <Suspense fallback={null}>
        <RotatingObject
          position={positions.attack}
          scale={diceScale}
          reducedMotion={reducedMotion}
          baseRotation={[0.28, -0.45, -0.08]}
        >
          <DiceShowcaseModel
            slot="dice_attack"
            assetRef={arsenal.diceAttack.assetRef}
          />
        </RotatingObject>
        <RotatingObject
          position={positions.defense}
          scale={diceScale}
          reducedMotion={reducedMotion}
          baseRotation={[0.28, 0.25, 0.08]}
        >
          <DiceShowcaseModel
            slot="dice_defense"
            assetRef={arsenal.diceDefense.assetRef}
          />
        </RotatingObject>
        <RotatingObject
          position={positions.neutral}
          scale={diceScale}
          reducedMotion={reducedMotion}
          baseRotation={[0.28, 0.65, -0.05]}
        >
          <DiceShowcaseModel
            slot="dice_neutral"
            assetRef={arsenal.diceNeutral.assetRef}
          />
        </RotatingObject>
        <RotatingObject
          position={positions.territory}
          scale={territoryScale}
          reducedMotion={reducedMotion}
          baseRotation={[-0.72, 0.18, 0.03]}
        >
          <TerritoryShowcaseModel
            cosmeticId={arsenal.territorySkin.id}
            assetRef={arsenal.territorySkin.assetRef}
            effectKey={arsenal.territorySkin.effectKey}
          />
        </RotatingObject>
      </Suspense>
    </>
  );
}

export function ProfileDisplayStage({
  arsenal,
}: {
  arsenal: PublicProfileArsenal;
}) {
  const reducedMotion = useReducedMotion();
  const items = [
    { id: arsenal.diceAttack.id, label: "ATAQUE", name: arsenal.diceAttack.name },
    { id: arsenal.diceDefense.id, label: "DEFESA", name: arsenal.diceDefense.name },
    { id: arsenal.diceNeutral.id, label: "NEUTRO", name: arsenal.diceNeutral.name },
    { id: arsenal.territorySkin.id, label: "TERRITÓRIO", name: arsenal.territorySkin.name },
  ] as const;

  return (
    <section className={styles.stage} aria-label="Arsenal equipado">
      <div className={styles.canvas} aria-hidden="true">
        <Canvas
          dpr={[1, 1.5]}
          orthographic
          camera={{ position: [0, 1.4, 10], zoom: 72, near: 0.1, far: 100 }}
          gl={{ alpha: true, antialias: true }}
        >
          <ProfileStageScene arsenal={arsenal} reducedMotion={reducedMotion} />
        </Canvas>
      </div>

      <div className={styles.labels}>
        {items.map((item) => (
          <span key={item.id} className={styles.label}>
            <small>{item.label}</small>
            <strong>{item.name}</strong>
          </span>
        ))}
      </div>
    </section>
  );
}
