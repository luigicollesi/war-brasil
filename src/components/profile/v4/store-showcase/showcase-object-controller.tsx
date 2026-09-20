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

const SHOWCASE_STANDBY_X = 8;
const SHOWCASE_SLIDE_LIFT_Y = 0.14;

export function ShowcaseObjectController({
  children,
  reducedMotion,
  transitionPhase,
  transitionDirection,
  objectType,
  itemId,
  itemIndex,
  selectedIndex,
  selectedItemId,
  transitionTargetItemId,
}: {
  children: ReactNode;
  reducedMotion: boolean;
  transitionPhase: ShowcaseTransitionPhase;
  transitionDirection: -1 | 1;
  objectType: ShowcaseObjectType;
  itemId: string;
  itemIndex: number;
  selectedIndex: number;
  selectedItemId: string | null;
  transitionTargetItemId: string | null;
}) {
  const groupRef = useRef<Group>(null);
  const transitionStartedAt = useRef(0);
  const invalidate = useThree((state) => state.invalidate);
  const viewportSize = useThree((state) => state.size);
  const compact = viewportSize.width <= 900;
  const viewportAspect =
    viewportSize.height > 0 ? viewportSize.width / viewportSize.height : 1;
  const presentation = resolveShowcasePresentation(
    objectType,
    compact,
    viewportAspect,
  );

  const isSelected = itemId === selectedItemId;
  const isTarget = itemId === transitionTargetItemId;
  const indexStandbyDirection: -1 | 1 =
    itemIndex < selectedIndex ? -1 : 1;
  const standbyDirection: -1 | 1 = isTarget
    ? transitionDirection
    : indexStandbyDirection;

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.rotation.set(...presentation.rotation);
    invalidate();
  }, [invalidate, presentation]);

  useEffect(() => {
    transitionStartedAt.current = performance.now();
    const group = groupRef.current;
    if (!group) return;

    group.position.y = 0;

    if (reducedMotion || transitionPhase === "idle") {
      group.position.x = isSelected
        ? 0
        : standbyDirection * SHOWCASE_STANDBY_X;
      group.scale.setScalar(
        presentation.objectScale * (isSelected ? 1 : 0.9),
      );
      invalidate();
      return;
    }

    if (transitionPhase === "slide") {
      if (isSelected) {
        group.position.x = 0;
        group.scale.setScalar(presentation.objectScale);
      } else if (isTarget) {
        group.position.x = transitionDirection * SHOWCASE_STANDBY_X;
        group.scale.setScalar(presentation.objectScale * 0.9);
      } else {
        group.position.x = standbyDirection * SHOWCASE_STANDBY_X;
        group.scale.setScalar(presentation.objectScale * 0.9);
      }
      invalidate();
    }
  }, [
    invalidate,
    isSelected,
    isTarget,
    presentation,
    reducedMotion,
    standbyDirection,
    transitionDirection,
    transitionPhase,
  ]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || reducedMotion) return;

    if (transitionPhase === "slide" && isSelected) {
      const progress = showcaseTransitionProgress({
        elapsedMs: performance.now() - transitionStartedAt.current,
        prefersReducedMotion: false,
      });
      group.position.x =
        -transitionDirection * SHOWCASE_STANDBY_X * progress;
      group.position.y =
        SHOWCASE_SLIDE_LIFT_Y * Math.sin(Math.PI * progress);
      group.scale.setScalar(
        presentation.objectScale * (1 - 0.1 * progress),
      );
      if (progress < 1) invalidate();
      return;
    }

    if (transitionPhase === "slide" && isTarget) {
      const progress = showcaseTransitionProgress({
        elapsedMs: performance.now() - transitionStartedAt.current,
        prefersReducedMotion: false,
      });
      group.position.x =
        transitionDirection * SHOWCASE_STANDBY_X * (1 - progress);
      group.position.y =
        SHOWCASE_SLIDE_LIFT_Y * Math.sin(Math.PI * progress);
      group.scale.setScalar(
        presentation.objectScale * (0.9 + 0.1 * progress),
      );
      if (progress < 1) invalidate();
      return;
    }

    if (!isSelected && !isTarget) return;
    if (!isSelected) return;
    group.rotation.y += idleAngularVelocity({ prefersReducedMotion: false }) * delta;
  });

  const initialX = isSelected ? 0 : standbyDirection * SHOWCASE_STANDBY_X;

  return (
    <group
      ref={groupRef}
      name={`StoreShowcaseObject:${itemId}`}
      position={[initialX, 0, 0]}
      rotation={[
        presentation.rotation[0],
        presentation.rotation[1],
        presentation.rotation[2],
      ]}
      scale={presentation.objectScale * (isSelected ? 1 : 0.9)}
    >
      {children}
    </group>
  );
}
