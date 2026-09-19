"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import type { Group } from "three";
import {
  resolveShowcasePresentation,
  type ShowcaseObjectType,
} from "@/src/lib/client/store-showcase/showcase-presentation";
import {
  idleAngularVelocity,
  showcaseTransitionProgress,
  type ShowcaseTransitionPhase,
} from "@/src/lib/client/store-showcase/showcase-motion";

export function ShowcaseObjectController({
  children,
  reducedMotion,
  transitionPhase,
  transitionDirection,
  objectType,
}: {
  children: ReactNode;
  reducedMotion: boolean;
  transitionPhase: ShowcaseTransitionPhase;
  transitionDirection: -1 | 1;
  objectType: ShowcaseObjectType;
}) {
  const groupRef = useRef<Group>(null);
  const transitionStartedAt = useRef(0);
  const invalidate = useThree((state) => state.invalidate);
  const compact = useThree((state) => state.size.width <= 900);
  const presentation = resolveShowcasePresentation(objectType, compact);

  useEffect(() => {
    transitionStartedAt.current = performance.now();
    const group = groupRef.current;
    if (!group) return;

    group.rotation.set(...presentation.rotation);

    if (transitionPhase === "idle" || reducedMotion) {
      group.position.x = 0;
      group.scale.setScalar(presentation.objectScale);
    } else if (transitionPhase === "enter") {
      group.position.x = -transitionDirection * 0.32;
      group.scale.setScalar(presentation.objectScale * 0.92);
    } else {
      group.position.x = 0;
      group.scale.setScalar(presentation.objectScale);
    }
    invalidate();
  }, [
    invalidate,
    presentation,
    reducedMotion,
    transitionDirection,
    transitionPhase,
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
        group.scale.setScalar(
          presentation.objectScale * (1 - 0.08 * progress),
        );
      } else {
        group.position.x =
          -transitionDirection * 0.32 * (1 - progress);
        group.scale.setScalar(
          presentation.objectScale * (0.92 + 0.08 * progress),
        );
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
      rotation={[
        presentation.rotation[0],
        presentation.rotation[1],
        presentation.rotation[2],
      ]}
    >
      {children}
    </group>
  );
}
