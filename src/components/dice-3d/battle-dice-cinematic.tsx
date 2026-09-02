"use client";

import { Canvas } from "@react-three/fiber";
import { createPortal } from "react-dom";
import { PCFShadowMap } from "three";
import { useCallback, useEffect, useMemo, useState } from "react";
import { validateDiceValues } from "@/src/lib/client/dice/dice-values";
import type { DiceValue } from "@/src/lib/client/dice/types";
import { playerColorHex } from "@/src/lib/client/player-color";
import type { GameBattle } from "@/src/lib/game-contract";
import type { PlayerColor } from "@/src/lib/lobby";
import styles from "./battle-dice-cinematic.module.css";
import { DiceTraySurface } from "./dice-tray-surface";
import { PredeterminedDiceRoll } from "./predetermined-dice-roll";
import {
  useDiceWebGLSupport,
  useReducedDiceMotion,
} from "./use-dice-presentation-capabilities";
import { useDiceFaceTextures } from "./use-dice-face-textures";

export type BattleDiceCinematicSide = "attack" | "defense";

export const BATTLE_DICE_CINEMATIC_TOTAL_MS = 1_800;
export const BATTLE_DICE_CINEMATIC_REPLAY_MS = 1_250;
const BATTLE_DICE_CINEMATIC_SETTLE_HOLD_MS = 420;
const MIN_LATE_REPLAY_MS = 360;

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

function CinematicScene({
  battle,
  side,
  values,
  color,
  elapsedMs,
  onComplete,
  onError,
}: {
  battle: GameBattle;
  side: BattleDiceCinematicSide;
  values: readonly DiceValue[];
  color: PlayerColor;
  elapsedMs: number;
  onComplete: () => void;
  onError: () => void;
}) {
  const textureState = useDiceFaceTextures({
    skin: side,
    pipColor: playerColorHex(color),
  });
  const replayDurationMs = Math.max(
    MIN_LATE_REPLAY_MS,
    BATTLE_DICE_CINEMATIC_REPLAY_MS - elapsedMs,
  );
  const seed = useMemo(
    () => cinematicSeed(battle, side, values),
    [battle, side, values],
  );

  useEffect(() => {
    if (textureState.error) onError();
  }, [onError, textureState.error]);

  if (!textureState.textures || textureState.error) return null;

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight
        position={[3.2, 6.8, 3.8]}
        intensity={3.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-4, 3.4, -1.5]} intensity={0.9} />
      <DiceTraySurface />
      <PredeterminedDiceRoll
        values={values}
        seed={seed}
        textures={textureState.textures}
        preparingFallback={null}
        failureFallback={null}
        playbackDurationMs={replayDurationMs}
        onComplete={onComplete}
        onError={onError}
      />
    </>
  );
}

export function BattleDiceCinematic({
  battle,
  side,
  color,
  elapsedMs,
  onComplete,
}: {
  battle: GameBattle;
  side: BattleDiceCinematicSide;
  color: PlayerColor;
  elapsedMs: number;
  onComplete: () => void;
}) {
  const webglSupported = useDiceWebGLSupport();
  const reducedMotion = useReducedDiceMotion();
  const [failed, setFailed] = useState(false);
  const [settled, setSettled] = useState(false);
  const values = useMemo(
    () =>
      validateDiceValues(
        side === "attack" ? battle.attacker : battle.defender,
      ),
    [battle.attacker, battle.defender, side],
  );
  const finish = useCallback(() => onComplete(), [onComplete]);
  const fail = useCallback(() => {
    setFailed(true);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (!webglSupported || reducedMotion || values.length === 0) {
      finish();
    }
  }, [finish, reducedMotion, values.length, webglSupported]);

  useEffect(() => {
    if (!settled) return;
    const timeoutId = window.setTimeout(
      finish,
      BATTLE_DICE_CINEMATIC_SETTLE_HOLD_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [finish, settled]);

  if (
    typeof document === "undefined" ||
    !webglSupported ||
    reducedMotion ||
    failed ||
    values.length === 0
  ) {
    return null;
  }

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
          camera={{ position: [0, 6.5, 2.1], fov: 34 }}
          onCreated={({ camera }) => camera.lookAt(0, -0.25, 0)}
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
            elapsedMs={elapsedMs}
            onComplete={() => setSettled(true)}
            onError={fail}
          />
        </Canvas>
      </div>
    </div>,
    document.body,
  );
}
