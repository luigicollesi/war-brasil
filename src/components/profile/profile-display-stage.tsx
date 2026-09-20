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

    group.rotation.y += delta * (hovered ? 0.42 : 0.14);

    const targetScale = scale * (hovered ? 1.07 : 1);
    const easing = 1 - Math.exp(-delta * 10);
    const nextScale = group.scale.x + (targetScale - group.scale.x) * easing;
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
  const { camera, size, viewport } = useThree();
  const compact = size.width <= 720;

  const worldPosition = (
    screenX: number,
    screenY: number,
  ): [number, number, number] => [
    camera.position.x + (screenX - 0.5) * viewport.width,
    camera.position.y + (0.5 - screenY) * viewport.height,
    0,
  ];

  const positions = compact
    ? {
        attack: worldPosition(0.27, 0.39),
        defense: worldPosition(0.73, 0.39),
        neutral: worldPosition(0.27, 0.68),
        territory: worldPosition(0.73, 0.68),
      }
    : {
        attack: worldPosition(0.14, 0.52),
        defense: worldPosition(0.38, 0.52),
        neutral: worldPosition(0.62, 0.52),
        territory: worldPosition(0.86, 0.52),
      };

  const diceScale = compact ? 1.08 : 1.42;
  const territoryScale = compact ? 0.82 : 1.04;

  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight position={[-5, 7, 8]} intensity={3.15} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} />
      <pointLight position={[0, -1, 5]} intensity={2.5} distance={14} />

      <Suspense fallback={null}>
        <RotatingObject
          position={positions.attack}
          scale={diceScale}
          reducedMotion={reducedMotion}
          baseRotation={[0.32, -0.52, -0.05]}
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
          baseRotation={[0.32, -0.44, 0.04]}
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
          baseRotation={[0.32, -0.49, -0.02]}
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
    {
      slot: "attack",
      label: "ATAQUE",
      name: arsenal.diceAttack.name,
    },
    {
      slot: "defense",
      label: "DEFESA",
      name: arsenal.diceDefense.name,
    },
    {
      slot: "neutral",
      label: "NEUTRO",
      name: arsenal.diceNeutral.name,
    },
    {
      slot: "territory",
      label: "TERRITÓRIO",
      name: arsenal.territorySkin.name,
    },
  ] as const;

  return (
    <section className={styles.stage} aria-label="Arsenal equipado">
      <div className={styles.canvas} aria-hidden="true">
        <Canvas
          dpr={[1, 1.5]}
          orthographic
          camera={{ position: [0, 0.8, 10], zoom: 72, near: 0.1, far: 100 }}
          gl={{ alpha: true, antialias: true }}
        >
          <ProfileStageScene arsenal={arsenal} reducedMotion={reducedMotion} />
        </Canvas>
      </div>

      <div className={styles.labels}>
        {items.map((item) => (
          <span
            key={item.slot}
            className={styles.label}
            data-showcase-slot={item.slot}
          >
            <small>{item.label}</small>
            <strong title={item.name}>{item.name}</strong>
          </span>
        ))}
      </div>
    </section>
  );
}
