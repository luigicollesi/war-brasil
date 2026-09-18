"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import type { Group } from "three";
import {
  idleAngularVelocity,
  showcaseTransitionProgress,
  type ShowcaseTransitionPhase,
} from "@/src/lib/client/store-showcase/showcase-motion";

const DESKTOP_SHOWCASE_SCALE = 0.92;

export function ShowcaseObjectController({
  children,
  reducedMotion,
  transitionPhase,
  transitionDirection,
}: {
  children: ReactNode;
  reducedMotion: boolean;
  transitionPhase: ShowcaseTransitionPhase;
  transitionDirection: -1 | 1;
}) {
  const groupRef = useRef<Group>(null);
  const transitionStartedAt = useRef(0);
  const invalidate = useThree((state) => state.invalidate);
  const viewScale = useThree((state) =>
    state.size.width > 900 ? DESKTOP_SHOWCASE_SCALE : 1,
  );

  useEffect(() => {
    transitionStartedAt.current = performance.now();
    const group = groupRef.current;
    if (!group) return;

    if (transitionPhase === "idle" || reducedMotion) {
      group.position.x = 0;
      group.scale.setScalar(viewScale);
    } else if (transitionPhase === "enter") {
      group.position.x = -transitionDirection * 0.32;
      group.scale.setScalar(viewScale * 0.92);
    } else {
      group.position.x = 0;
      group.scale.setScalar(viewScale);
    }
    invalidate();
  }, [
    invalidate,
    reducedMotion,
    transitionDirection,
    transitionPhase,
    viewScale,
  ]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (transitionPhase !== "idle" && !reducedMotion) {
      const progress = showcaseTransitionProgress({
        elapsedMs: performance.now() - transitionStartedAt.current,
        prefersReducedMotion: reducedMotion,
      });

      if (transitionPhase === "exit") {
        group.position.x = transitionDirection * 0.32 * progress;
        group.scale.setScalar(viewScale * (1 - 0.08 * progress));
      } else {
        group.position.x =
          -transitionDirection * 0.32 * (1 - progress);
        group.scale.setScalar(viewScale * (0.92 + 0.08 * progress));
      }

      if (progress < 1) invalidate();
      return;
    }

    if (reducedMotion) return;
    group.rotation.y += idleAngularVelocity({ prefersReducedMotion: false }) * delta;
  });

  return (
    <group
      ref={groupRef}
      name="StoreShowcaseObject"
      rotation={[-0.12, -0.52, 0]}
    >
      {children}
    </group>
  );
}
