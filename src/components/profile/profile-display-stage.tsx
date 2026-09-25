"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Group } from "three";
import type { PublicProfileArsenal } from "@/src/lib/profile/profile-command-contract";
import { DiceShowcaseModel } from "./v4/store-showcase/dice-showcase-model";
import { TerritoryShowcaseModel } from "./v4/store-showcase/territory-showcase-model";
import { PROFILE_DISPLAY_LAYOUTS, type ProfileDisplaySlot } from "./profile-display-stage-layout";
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
  const compactShort = compact && size.height <= 760;
  const layout = compactShort
    ? PROFILE_DISPLAY_LAYOUTS.compactShort
    : compact
      ? PROFILE_DISPLAY_LAYOUTS.compact
      : PROFILE_DISPLAY_LAYOUTS.desktop;

  const worldPosition = (
    slot: ProfileDisplaySlot,
  ): [number, number, number] => {
    const item = layout[slot];
    return [
      camera.position.x + (item.x - 0.5) * viewport.width,
      camera.position.y + (0.5 - item.y) * viewport.height,
      0,
    ];
  };

  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight position={[-5, 7, 8]} intensity={3.15} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} />
      <pointLight position={[0, -1, 5]} intensity={2.5} distance={14} />

      <Suspense fallback={null}>
        <RotatingObject
          position={worldPosition("attack")}
          scale={layout.attack.scale}
          reducedMotion={reducedMotion}
          baseRotation={[0.32, -0.52, -0.05]}
        >
          <DiceShowcaseModel
            slot="dice_attack"
            assetRef={arsenal.diceAttack.assetRef}
            bodyColor={arsenal.diceAttack.bodyColor}
            bodyHighlightColor={arsenal.diceAttack.bodyHighlightColor}
          />
        </RotatingObject>

        <RotatingObject
          position={worldPosition("defense")}
          scale={layout.defense.scale}
          reducedMotion={reducedMotion}
          baseRotation={[0.32, -0.44, 0.04]}
        >
          <DiceShowcaseModel
            slot="dice_defense"
            assetRef={arsenal.diceDefense.assetRef}
            bodyColor={arsenal.diceDefense.bodyColor}
            bodyHighlightColor={arsenal.diceDefense.bodyHighlightColor}
          />
        </RotatingObject>

        <RotatingObject
          position={worldPosition("neutral")}
          scale={layout.neutral.scale}
          reducedMotion={reducedMotion}
          baseRotation={[0.32, -0.49, -0.02]}
        >
          <DiceShowcaseModel
            slot="dice_neutral"
            assetRef={arsenal.diceNeutral.assetRef}
            bodyColor={arsenal.diceNeutral.bodyColor}
            bodyHighlightColor={arsenal.diceNeutral.bodyHighlightColor}
          />
        </RotatingObject>

        <RotatingObject
          position={worldPosition("territory")}
          scale={layout.territory.scale}
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
  ] as const satisfies ReadonlyArray<{
    slot: ProfileDisplaySlot;
    label: string;
    name: string;
  }>;

  const labelStyle = (slot: ProfileDisplaySlot) =>
    ({
      "--profile-label-x": `${PROFILE_DISPLAY_LAYOUTS.desktop[slot].labelX * 100}%`,
      "--profile-label-y": `${PROFILE_DISPLAY_LAYOUTS.desktop[slot].labelY * 100}%`,
      "--profile-label-x-compact": `${PROFILE_DISPLAY_LAYOUTS.compact[slot].labelX * 100}%`,
      "--profile-label-y-compact": `${PROFILE_DISPLAY_LAYOUTS.compact[slot].labelY * 100}%`,
      "--profile-label-x-compact-short": `${PROFILE_DISPLAY_LAYOUTS.compactShort[slot].labelX * 100}%`,
      "--profile-label-y-compact-short": `${PROFILE_DISPLAY_LAYOUTS.compactShort[slot].labelY * 100}%`,
    }) as CSSProperties;

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
            style={labelStyle(item.slot)}
          >
            <small>{item.label}</small>
            <strong title={item.name}>{item.name}</strong>
          </span>
        ))}
      </div>
    </section>
  );
}
