"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Color, EdgesGeometry, ExtrudeGeometry } from "three";
import { COMMAND_ENTRANCE_RECIPE } from "./entrance-timeline";
import {
  readOpeningSeek,
  resolveOpeningProgress,
  sampleOpeningCue,
} from "./opening-timeline";
import type {
  CommandEntranceState,
  CommandSceneState,
} from "./scene-contract";
import {
  createTerritoryGenesisMaterial,
  type TerritoryGenesisMaterialHandle,
} from "./territory-genesis-material";

export type TerritoryGenesisPlate = Readonly<{
  id: string;
  territoryId: number;
  geometry: ExtrudeGeometry;
  edges: EdgesGeometry;
  canonicalColor: Color;
}>;

type TerritoryGenesisPassProps = {
  plates: readonly TerritoryGenesisPlate[];
  entranceState: CommandEntranceState;
  onScenePhaseChange: (state: CommandSceneState) => void;
};

export function TerritoryGenesisPass({
  plates,
  entranceState,
  onScenePhaseChange,
}: TerritoryGenesisPassProps) {
  const startedAtRef = useRef<number | null>(null);
  const emittedPhaseRef = useRef<CommandSceneState | null>(null);
  const completedRef = useRef(false);
  const handles = useMemo<TerritoryGenesisMaterialHandle[]>(
    () =>
      plates.map((plate) =>
        createTerritoryGenesisMaterial(
          plate.canonicalColor,
          plate.territoryId,
        ),
      ),
    [plates],
  );

  useEffect(() => {
    if (entranceState !== "primed") return;
    startedAtRef.current = null;
    emittedPhaseRef.current = null;
    completedRef.current = false;
    for (const handle of handles) handle.setProgress(0);
  }, [entranceState, handles]);

  useFrame(() => {
    if (entranceState !== "playing" || completedRef.current) return;

    const now = performance.now();
    if (startedAtRef.current === null) {
      startedAtRef.current = now;
    }

    const forcedProgress = readOpeningSeek(COMMAND_ENTRANCE_RECIPE.id);
    const globalProgress =
      forcedProgress ??
      resolveOpeningProgress(
        now,
        startedAtRef.current,
        COMMAND_ENTRANCE_RECIPE.durationMs,
      );
    const materialProgress = sampleOpeningCue(
      globalProgress,
      COMMAND_ENTRANCE_RECIPE.cues.materialization,
    );

    for (const handle of handles) handle.setProgress(materialProgress);

    const nextPhase: CommandSceneState =
      globalProgress >= 1
        ? "ready"
        : globalProgress >= COMMAND_ENTRANCE_RECIPE.settlingStart
          ? "settling"
          : "playing";

    if (nextPhase !== emittedPhaseRef.current) {
      emittedPhaseRef.current = nextPhase;
      onScenePhaseChange(nextPhase);
    }

    if (globalProgress >= 1) {
      completedRef.current = true;
    }
  });

  useEffect(
    () => () => {
      for (const handle of handles) handle.material.dispose();
    },
    [handles],
  );

  return (
    <group name="HomeGenesisPass" renderOrder={2}>
      {plates.map((plate, index) => (
        <mesh
          key={`genesis-${plate.id}`}
          geometry={plate.geometry}
          material={handles[index].material}
          renderOrder={2}
        />
      ))}
    </group>
  );
}
