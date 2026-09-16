"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import type { Group } from "three";
import {
  SHOWCASE_INTERACTION_RESUME_MS,
  SHOWCASE_ITEM_TRANSITION_PHASE_MS,
  idleAngularVelocity,
  resolveShowcaseDragRotation,
  showcaseTransitionProgress,
  type ShowcaseTransitionPhase,
} from "@/src/lib/client/store-showcase/showcase-motion";

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
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    clientX: 0,
    clientY: 0,
    resumeAt: 0,
  });
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    transitionStartedAt.current = performance.now();
    const group = groupRef.current;
    if (!group) return;

    if (transitionPhase === "idle" || reducedMotion) {
      group.position.x = 0;
      group.scale.setScalar(1);
    } else if (transitionPhase === "enter") {
      group.position.x = -transitionDirection * 0.32;
      group.scale.setScalar(0.92);
    } else {
      group.position.x = 0;
      group.scale.setScalar(1);
    }
    invalidate();
  }, [invalidate, reducedMotion, transitionDirection, transitionPhase]);

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
        group.scale.setScalar(1 - 0.08 * progress);
      } else {
        group.position.x = -transitionDirection * 0.32 * (1 - progress);
        group.scale.setScalar(0.92 + 0.08 * progress);
      }

      if (progress < 1) invalidate();
      return;
    }

    if (reducedMotion || dragRef.current.active) return;
    if (performance.now() < dragRef.current.resumeAt) return;
    group.rotation.y += idleAngularVelocity({ prefersReducedMotion: false }) * delta;
  });

  function onPointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const group = groupRef.current;
    if (!group || transitionPhase !== "idle") return;

    dragRef.current.active = true;
    dragRef.current.pointerId = event.pointerId;
    dragRef.current.clientX = event.clientX;
    dragRef.current.clientY = event.clientY;
    dragRef.current.resumeAt = Number.POSITIVE_INFINITY;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    invalidate();
  }

  function onPointerMove(event: ThreeEvent<PointerEvent>) {
    const group = groupRef.current;
    if (!group || !dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    const deltaX = event.clientX - dragRef.current.clientX;
    const deltaY = event.clientY - dragRef.current.clientY;
    const rotation = resolveShowcaseDragRotation({
      yaw: group.rotation.y,
      pitch: group.rotation.x,
      deltaX,
      deltaY,
    });

    group.rotation.y = rotation.yaw;
    group.rotation.x = rotation.pitch;
    dragRef.current.clientX = event.clientX;
    dragRef.current.clientY = event.clientY;
    invalidate();
  }

  function finishInteraction(event: ThreeEvent<PointerEvent>) {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    dragRef.current.active = false;
    dragRef.current.pointerId = -1;
    dragRef.current.resumeAt = performance.now() + SHOWCASE_INTERACTION_RESUME_MS;
    (event.target as Element).releasePointerCapture?.(event.pointerId);
    invalidate();
  }

  return (
    <group
      ref={groupRef}
      name="StoreShowcaseObject"
      rotation={[-0.12, -0.52, 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishInteraction}
      onPointerCancel={finishInteraction}
      onPointerLeave={(event) => {
        if (dragRef.current.active) finishInteraction(event);
      }}
    >
      {children}
    </group>
  );
}
