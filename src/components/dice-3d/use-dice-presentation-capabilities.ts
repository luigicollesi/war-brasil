"use client";

import { useSyncExternalStore } from "react";
import { supportsDiceWebGL } from "@/src/lib/client/dice/webgl-support";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeNoop() {
  return () => {};
}

function subscribeReducedMotion(onStoreChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function reducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function serverFalseSnapshot() {
  return false;
}

export function useReducedDiceMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    serverFalseSnapshot,
  );
}

export function useDiceWebGLSupport() {
  return useSyncExternalStore(
    subscribeNoop,
    supportsDiceWebGL,
    serverFalseSnapshot,
  );
}
