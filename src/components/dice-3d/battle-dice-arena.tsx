"use client";

import { Canvas } from "@react-three/fiber";
import { useCallback, useMemo, useState } from "react";
import { GameDie } from "@/src/components/game-die";
import type { PlayerColor } from "@/src/lib/lobby";
import {
  BATTLE_DICE_DOCK_MS,
  BATTLE_DICE_REPLAY_MS,
  battleDiceDockPositions,
  battleDiceDockScale,
  type BattleDiceDockSide,
} from "@/src/lib/client/dice/battle-dice-layout";
import { validateDiceValues } from "@/src/lib/client/dice/dice-values";
import type { DiceFaceTextureSet, DiceValue } from "@/src/lib/client/dice/types";
import type { GameBattle } from "@/src/lib/game-contract";
import { DiceTraySurface } from "./dice-tray-surface";
import { PredeterminedDiceRoll } from "./predetermined-dice-roll";
import {
  useDiceWebGLSupport,
  useReducedDiceMotion,
} from "./use-dice-presentation-capabilities";
import { useDiceFaceTextures } from "./use-dice-face-textures";

function rollSeed(
  battle: GameBattle,
  side: BattleDiceDockSide,
  values: readonly DiceValue[],
) {
  return [
    "battle-dice",
    battle.attackerPlayerId,
    battle.attackerTerritoryId,
    battle.defenderPlayerId,
    battle.defenderTerritoryId,
    side,
    battle.stageStartedAt,
    values.join("-"),
  ].join(":");
}

function BattleDiceFallback({
  attackValues,
  defenseValues,
  attackerColor,
  defenderColor,
}: {
  attackValues: readonly DiceValue[];
  defenseValues: readonly DiceValue[];
  attackerColor: PlayerColor;
  defenderColor: PlayerColor;
}) {
  return (
    <div className="battle-dice-arena battle-dice-arena--fallback" aria-live="polite">
      {attackValues.length ? (
        <div className="battle-dice-fallback-side battle-dice-fallback-side--attack">
          <span>Ataque</span>
          <div>
            {attackValues.map((value, index) => (
              <GameDie
                key={`attack-fallback-${index}-${value}`}
                value={value}
                color={attackerColor}
                className="battle-die"
              />
            ))}
          </div>
        </div>
      ) : null}

      {defenseValues.length ? (
        <div className="battle-dice-fallback-side battle-dice-fallback-side--defense">
          <span>Defesa</span>
          <div>
            {defenseValues.map((value, index) => (
              <GameDie
                key={`defense-fallback-${index}-${value}`}
                value={value}
                color={defenderColor}
                className="battle-die"
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BattleDiceSidePresentation({
  battle,
  side,
  values,
  textures,
  onPhysicsError,
}: {
  battle: GameBattle;
  side: BattleDiceDockSide;
  values: readonly DiceValue[];
  textures: DiceFaceTextureSet;
  onPhysicsError: () => void;
}) {
  const [seed] = useState(() => rollSeed(battle, side, values));
  const activeStage =
    side === "attack" ? "show_attacker_result" : "show_defender_result";

  return (
    <PredeterminedDiceRoll
      values={values}
      seed={seed}
      textures={textures}
      preparingFallback={null}
      failureFallback={null}
      playbackDurationMs={BATTLE_DICE_REPLAY_MS}
      dockDurationMs={BATTLE_DICE_DOCK_MS}
      dockPositions={battleDiceDockPositions(side, values.length)}
      dockScale={battleDiceDockScale(values.length)}
      skipAnimation={battle.stage !== activeStage}
      onError={onPhysicsError}
    />
  );
}

function BattleDiceCanvasStage({
  battle,
  attackValues,
  defenseValues,
  attackTextures,
  defenseTextures,
  onPhysicsError,
}: {
  battle: GameBattle;
  attackValues: readonly DiceValue[];
  defenseValues: readonly DiceValue[];
  attackTextures: DiceFaceTextureSet;
  defenseTextures: DiceFaceTextureSet;
  onPhysicsError: () => void;
}) {
  return (
    <>
      <ambientLight intensity={1.35} />
      <directionalLight
        position={[3.5, 5.5, 4.5]}
        intensity={3.2}
        castShadow
      />
      <directionalLight position={[-4, 2.5, 2]} intensity={1.1} />
      <DiceTraySurface />

      {attackValues.length ? (
        <BattleDiceSidePresentation
          side="attack"
          battle={battle}
          values={attackValues}
          textures={attackTextures}
          onPhysicsError={onPhysicsError}
        />
      ) : null}

      {defenseValues.length ? (
        <BattleDiceSidePresentation
          side="defense"
          battle={battle}
          values={defenseValues}
          textures={defenseTextures}
          onPhysicsError={onPhysicsError}
        />
      ) : null}
    </>
  );
}

export function BattleDiceArena({
  battle,
  attackerColor = "forest",
  defenderColor = "ruby",
}: {
  battle: GameBattle;
  attackerColor?: PlayerColor;
  defenderColor?: PlayerColor;
}) {
  const attackValues = useMemo<DiceValue[]>(
    () => (battle.attacker.length ? validateDiceValues(battle.attacker) : []),
    [battle.attacker],
  );
  const defenseValues = useMemo<DiceValue[]>(
    () => (battle.defender.length ? validateDiceValues(battle.defender) : []),
    [battle.defender],
  );
  const webglSupported = useDiceWebGLSupport();
  const reducedMotion = useReducedDiceMotion();
  const attackTextureState = useDiceFaceTextures({ skin: "attack" });
  const defenseTextureState = useDiceFaceTextures({ skin: "defense" });
  const [physicsFailed, setPhysicsFailed] = useState(false);
  const handlePhysicsError = useCallback(() => setPhysicsFailed(true), []);
  const presentationIdentity = `${battle.attackerPlayerId}:${battle.attackerTerritoryId}:${battle.defenderPlayerId}:${battle.defenderTerritoryId}`;

  const shouldFallback =
    !webglSupported ||
    reducedMotion ||
    physicsFailed ||
    Boolean(attackTextureState.error || defenseTextureState.error);

  if (shouldFallback) {
    return (
      <BattleDiceFallback
        attackValues={attackValues}
        defenseValues={defenseValues}
        attackerColor={attackerColor}
        defenderColor={defenderColor}
      />
    );
  }

  if (!attackTextureState.textures || !defenseTextureState.textures) {
    return <div className="battle-dice-arena" aria-hidden="true" />;
  }

  return (
    <div
      className="battle-dice-arena"
      aria-label={`Dados de combate. Ataque: ${attackValues.join(", ") || "aguardando"}. Defesa: ${defenseValues.join(", ") || "aguardando"}.`}
      aria-live="polite"
    >
      {attackValues.length ? (
        <span className="battle-dice-edge-label battle-dice-edge-label--attack">
          Ataque
        </span>
      ) : null}
      {defenseValues.length ? (
        <span className="battle-dice-edge-label battle-dice-edge-label--defense">
          Defesa
        </span>
      ) : null}

      <div className="battle-dice-arena-canvas" aria-hidden="true">
        <Canvas
          shadows
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ position: [0, 2.9, 6.3], fov: 32 }}
          onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
        >
          <BattleDiceCanvasStage
            key={presentationIdentity}
            battle={battle}
            attackValues={attackValues}
            defenseValues={defenseValues}
            attackTextures={attackTextureState.textures}
            defenseTextures={defenseTextureState.textures}
            onPhysicsError={handlePhysicsError}
          />
        </Canvas>
      </div>
    </div>
  );
}
