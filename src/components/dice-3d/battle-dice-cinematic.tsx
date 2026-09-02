"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { createPortal } from "react-dom";
import { PCFShadowMap, PerspectiveCamera } from "three";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { validateDiceValues } from "@/src/lib/client/dice/dice-values";
import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";
import type { DiceValue } from "@/src/lib/client/dice/types";
import { playerColorHex } from "@/src/lib/client/player-color";
import type { GameBattle } from "@/src/lib/game-contract";
import type { PlayerColor } from "@/src/lib/lobby";
import styles from "./battle-dice-cinematic.module.css";
import { PredeterminedDiceRoll } from "./predetermined-dice-roll";
import {
  useDiceWebGLSupport,
  useReducedDiceMotion,
} from "./use-dice-presentation-capabilities";
import { useDiceFaceTextures } from "./use-dice-face-textures";

export type BattleDiceCinematicSide = "attack" | "defense";

export const BATTLE_DICE_CINEMATIC_TOTAL_MS = 1_800;
export const BATTLE_DICE_CINEMATIC_REPLAY_MS = 1_250;
const MIN_PRESENTATION_REMAINING_MS = 280;
const PORTRAIT_ASPECT_THRESHOLD = 0.82;

function presentationElapsedMs(stageStartedAt: string) {
  const startedAtMs = Date.parse(stageStartedAt);
  if (!Number.isFinite(startedAtMs)) return BATTLE_DICE_CINEMATIC_TOTAL_MS;
  return Math.min(
    BATTLE_DICE_CINEMATIC_TOTAL_MS,
    Math.max(0, Date.now() - startedAtMs),
  );
}

function cinematicSeed(
  battle: GameBattle,
  side: BattleDiceCinematicSide,
  values: readonly DiceValue[],
) {
  return [
    "battle-dice-cinematic",
    battle.attackerPlayerId,
    battle.attackerTerritoryId,
    battle.defenderPlayerId,
    battle.defenderTerritoryId,
    side,
    battle.stageStartedAt,
    values.join("-"),
  ].join(":");
}

function CinematicCameraRig() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || size.height <= 0) return;

    const aspect = size.width / size.height;
    const portrait = aspect < PORTRAIT_ASPECT_THRESHOLD;
    const compact = !portrait && aspect < 1.2;

    if (portrait) {
      camera.position.set(0, 8.65, 3.05);
      camera.fov = 36;
    } else if (compact) {
      camera.position.set(0, 7.45, 2.55);
      camera.fov = 35;
    } else {
      camera.position.set(0, 6.55, 2.2);
      camera.fov = 34;
    }

    camera.lookAt(0, -0.32, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, size.height, size.width]);

  return null;
}

function CinematicShadowSurface() {
  return (
    <mesh
      position={[0, DICE_PHYSICS.floorTopY + 0.001, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[6.4, 6.4]} />
      <shadowMaterial transparent opacity={0.24} depthWrite={false} />
    </mesh>
  );
}

function CinematicScene({
  battle,
  side,
  values,
  color,
  initialElapsedMs,
  onError,
}: {
  battle: GameBattle;
  side: BattleDiceCinematicSide;
  values: readonly DiceValue[];
  color: PlayerColor;
  initialElapsedMs: number;
  onError: () => void;
}) {
  const size = useThree((state) => state.size);
  const textureState = useDiceFaceTextures({
    skin: side,
    pipColor: playerColorHex(color),
  });
  const seed = useMemo(
    () => cinematicSeed(battle, side, values),
    [battle, side, values],
  );
  const portrait =
    size.height > 0 && size.width / size.height < PORTRAIT_ASPECT_THRESHOLD;

  useEffect(() => {
    if (textureState.error) onError();
  }, [onError, textureState.error]);

  if (!textureState.textures || textureState.error) return null;

  return (
    <>
      <CinematicCameraRig />
      <ambientLight intensity={1.05} />
      <directionalLight
        position={[3.2, 6.8, 3.8]}
        intensity={3.15}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.00035}
      />
      <directionalLight position={[-4, 3.4, -1.5]} intensity={0.85} />
      <CinematicShadowSurface />
      <group rotation={[0, portrait ? Math.PI / 2 : 0, 0]}>
        <PredeterminedDiceRoll
          values={values}
          seed={seed}
          textures={textureState.textures}
          preparingFallback={null}
          failureFallback={null}
          playbackDurationMs={BATTLE_DICE_CINEMATIC_REPLAY_MS}
          initialElapsedMs={Math.min(
            initialElapsedMs,
            BATTLE_DICE_CINEMATIC_REPLAY_MS,
          )}
          onError={onError}
        />
      </group>
    </>
  );
}

export function BattleDiceCinematic({
  battle,
  side,
  color,
  onComplete,
}: {
  battle: GameBattle;
  side: BattleDiceCinematicSide;
  color: PlayerColor;
  onComplete: () => void;
}) {
  const webglSupported = useDiceWebGLSupport();
  const reducedMotion = useReducedDiceMotion();
  const completedRef = useRef(false);
  const [initialElapsedMs] = useState(() =>
    presentationElapsedMs(battle.stageStartedAt),
  );
  const values = useMemo(
    () =>
      validateDiceValues(
        side === "attack" ? battle.attacker : battle.defender,
      ),
    [battle.attacker, battle.defender, side],
  );
  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);
  const remainingMs = Math.max(
    0,
    BATTLE_DICE_CINEMATIC_TOTAL_MS - initialElapsedMs,
  );
  const shouldSkip =
    !webglSupported ||
    reducedMotion ||
    values.length === 0 ||
    remainingMs < MIN_PRESENTATION_REMAINING_MS;

  useEffect(() => {
    if (shouldSkip) {
      const timeoutId = window.setTimeout(finish, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const timeoutId = window.setTimeout(finish, remainingMs);
    return () => window.clearTimeout(timeoutId);
  }, [finish, remainingMs, shouldSkip]);

  if (typeof document === "undefined" || shouldSkip) return null;

  return createPortal(
    <div
      className={styles.root}
      aria-hidden="true"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.preventDefault()}
    >
      <div className={styles.backdrop} />
      <div className={styles.label}>
        {side === "attack" ? "ATAQUE" : "DEFESA"}
      </div>
      <div className={styles.canvas}>
        <Canvas
          shadows={{ type: PCFShadowMap }}
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ position: [0, 6.55, 2.2], fov: 34 }}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
        >
          <CinematicScene
            battle={battle}
            side={side}
            values={values}
            color={color}
            initialElapsedMs={initialElapsedMs}
            onError={finish}
          />
        </Canvas>
      </div>
    </div>,
    document.body,
  );
}
