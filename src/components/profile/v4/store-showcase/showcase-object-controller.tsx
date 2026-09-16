"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import type { Group } from "three";
import {
  SHOWCASE_INTERACTION_RESUME_MS,
  idleAngularVelocity,
  resolveShowcaseDragRotation,
} from "@/src/lib/client/store-showcase/showcase-motion";

export function ShowcaseObjectController({
  children,
  reducedMotion,
}: {
  children: ReactNode;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    clientX: 0,
    clientY: 0,
    resumeAt: 0,
  });
  const invalidate = useThree((state) => state.invalidate);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || reducedMotion || dragRef.current.active) return;
    if (performance.now() < dragRef.current.resumeAt) return;
    group.rotation.y += idleAngularVelocity({ prefersReducedMotion: false }) * delta;
  });

  function onPointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const group = groupRef.current;
    if (!group) return;

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
