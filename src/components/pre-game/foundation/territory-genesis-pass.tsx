"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  type Color,
  type EdgesGeometry,
  type ExtrudeGeometry,
  type Object3D,
  type Scene,
} from "three";
import { COMMAND_ENTRANCE_RECIPE } from "./entrance-timeline";
import {
  readOpeningSeek,
  resolveOpeningProgress,
  sampleContinuousOpeningCue,
} from "./opening-timeline";
import type {
  CommandEntranceState,
  CommandSceneState,
} from "./scene-contract";
import {
  buildTerritoryIngressDescriptors,
  sampleTerritoryIngress,
} from "./territory-ingress";
import {
  createTerritoryGenesisMaterial,
  type TerritoryGenesisMaterialHandle,
} from "./territory-genesis-material";

const GENESIS_RING_CENTER = 627;
const GENESIS_RING_INNER_RADIUS = 846;
const GENESIS_RING_OUTER_RADIUS = 862;
const PROFILE_ORBIT_A_SWEEP = 0.72;
const PROFILE_ORBIT_B_SWEEP = 0.56;
const PROFILE_ORBIT_C_SWEEP = 0.64;

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

type StoredMaterialState<TMaterial extends MeshStandardMaterial | LineBasicMaterial> = {
  material: TMaterial;
  opacity: number;
  transparent: boolean;
};

type StoredCommandRingState = StoredMaterialState<MeshStandardMaterial> & {
  object: Mesh;
  rotationZ: number;
  finalOpacity: number;
};

type StoredProfileOrbit = {
  object: Group;
  finalRotation: readonly [number, number, number];
};

type StoredProfileOrbState = {
  object: Group;
  finalScale: number;
  finalVisible: boolean;
  orbitA: StoredProfileOrbit | null;
  orbitB: StoredProfileOrbit | null;
  orbitC: StoredProfileOrbit | null;
};

function belongsToGenesisPass(object: Object3D) {
  let current: Object3D | null = object;
  while (current) {
    if (current.name === "HomeGenesisPass") return true;
    current = current.parent;
  }
  return false;
}

function readProfileOrbit(scene: Scene, name: string): StoredProfileOrbit | null {
  const object = scene.getObjectByName(name);
  if (!(object instanceof Group)) return null;
  return {
    object,
    finalRotation: [object.rotation.x, object.rotation.y, object.rotation.z],
  };
}

function createSceneTargetsController() {
  let finalSurfaces: StoredMaterialState<MeshStandardMaterial>[] = [];
  let finalEdges: StoredMaterialState<LineBasicMaterial>[] = [];
  let commandRing: StoredCommandRingState | null = null;
  let profileOrb: StoredProfileOrbState | null = null;
  let finalSurfaceVisible = true;

  const restoreProfileOrb = () => {
    if (!profileOrb) return;

    profileOrb.object.visible = profileOrb.finalVisible;
    profileOrb.object.scale.setScalar(profileOrb.finalScale);

    if (profileOrb.orbitA) {
      profileOrb.orbitA.object.rotation.set(...profileOrb.orbitA.finalRotation);
    }
    if (profileOrb.orbitB) {
      profileOrb.orbitB.object.rotation.set(...profileOrb.orbitB.finalRotation);
    }
    if (profileOrb.orbitC) {
      profileOrb.orbitC.object.rotation.set(...profileOrb.orbitC.finalRotation);
    }
  };

  const restore = () => {
    for (const state of finalSurfaces) {
      state.material.opacity = state.opacity;
      state.material.transparent = state.transparent;
      state.material.needsUpdate = true;
    }
    for (const state of finalEdges) {
      state.material.opacity = state.opacity;
      state.material.transparent = state.transparent;
    }
    if (commandRing) {
      commandRing.object.rotation.z = commandRing.rotationZ;
      commandRing.material.opacity = commandRing.finalOpacity;
      commandRing.material.transparent = commandRing.transparent;
      commandRing.material.needsUpdate = true;
    }
    restoreProfileOrb();
    finalSurfaceVisible = true;
  };

  return {
    capture(scene: Scene, plates: readonly TerritoryGenesisPlate[]) {
      restore();
      finalSurfaces = [];
      finalEdges = [];
      commandRing = null;
      profileOrb = null;

      const plateGeometries = new Set(plates.map((plate) => plate.geometry));
      const edgeGeometries = new Set(plates.map((plate) => plate.edges));
      const surfaceMaterials = new Set<MeshStandardMaterial>();
      const edgeMaterials = new Set<LineBasicMaterial>();
      const assembly = scene.getObjectByName("BrazilTerritoryAssembly");

      assembly?.traverse((object) => {
        if (belongsToGenesisPass(object)) return;

        if (
          object instanceof Mesh &&
          plateGeometries.has(object.geometry as ExtrudeGeometry) &&
          object.material instanceof MeshStandardMaterial
        ) {
          surfaceMaterials.add(object.material);
        }

        if (
          object instanceof LineSegments &&
          edgeGeometries.has(object.geometry as EdgesGeometry) &&
          object.material instanceof LineBasicMaterial
        ) {
          edgeMaterials.add(object.material);
        }
      });

      finalSurfaces = [...surfaceMaterials].map((material) => ({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
      }));
      finalEdges = [...edgeMaterials].map((material) => ({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
      }));

      const ringObject = scene.getObjectByName("DomainTable-GoldenRing");
      if (
        ringObject instanceof Mesh &&
        ringObject.geometry instanceof RingGeometry &&
        ringObject.material instanceof MeshStandardMaterial
      ) {
        const declaredFinalOpacity = Number(ringObject.userData.finalOpacity);
        commandRing = {
          object: ringObject,
          material: ringObject.material,
          opacity: ringObject.material.opacity,
          transparent: ringObject.material.transparent,
          rotationZ: ringObject.rotation.z,
          finalOpacity: Number.isFinite(declaredFinalOpacity)
            ? declaredFinalOpacity
            : 1,
        };
      }

      const profileObject = scene.getObjectByName("CommandInsignia");
      if (profileObject instanceof Group) {
        const declaredFinalScale = Number(profileObject.userData.openingFinalScale);
        profileOrb = {
          object: profileObject,
          finalScale: Number.isFinite(declaredFinalScale)
            ? declaredFinalScale
            : profileObject.scale.x,
          finalVisible: true,
          orbitA: readProfileOrbit(scene, "ProfileOrb-OrbitA"),
          orbitB: readProfileOrbit(scene, "ProfileOrb-OrbitB"),
          orbitC: readProfileOrbit(scene, "ProfileOrb-OrbitC"),
        };
      }
    },

    prime() {
      for (const state of finalSurfaces) {
        state.material.transparent = true;
        state.material.opacity = 0;
        state.material.needsUpdate = true;
      }
      for (const state of finalEdges) {
        state.material.transparent = true;
        state.material.opacity = 0;
      }
      if (commandRing) {
        commandRing.object.rotation.z = commandRing.rotationZ;
        commandRing.material.transparent = true;
        commandRing.material.opacity = 0;
        commandRing.material.needsUpdate = true;
      }
      if (profileOrb) {
        profileOrb.object.visible = true;
        profileOrb.object.scale.setScalar(0.001);
        if (profileOrb.orbitA) {
          const [x, y, z] = profileOrb.orbitA.finalRotation;
          profileOrb.orbitA.object.rotation.set(x, y - PROFILE_ORBIT_A_SWEEP, z);
        }
        if (profileOrb.orbitB) {
          const [x, y, z] = profileOrb.orbitB.finalRotation;
          profileOrb.orbitB.object.rotation.set(x - PROFILE_ORBIT_B_SWEEP, y, z);
        }
        if (profileOrb.orbitC) {
          const [x, y, z] = profileOrb.orbitC.finalRotation;
          profileOrb.orbitC.object.rotation.set(x, y, z + PROFILE_ORBIT_C_SWEEP);
        }
      }
      finalSurfaceVisible = false;
    },

    setGenesisProgress(progress: number) {
      if (progress > 0 && !finalSurfaceVisible) {
        for (const state of finalSurfaces) {
          state.material.opacity = state.opacity;
          state.material.transparent = state.transparent;
          state.material.needsUpdate = true;
        }
        finalSurfaceVisible = true;
      }

      for (const state of finalEdges) {
        state.material.opacity = state.opacity * progress;
      }
      if (commandRing) {
        commandRing.object.rotation.z = commandRing.rotationZ + Math.PI * 2 * progress;
        commandRing.material.opacity = commandRing.finalOpacity * progress;
      }
    },

    setProfileProgress(progress: number) {
      if (!profileOrb) return;

      profileOrb.object.scale.setScalar(
        Math.max(0.001, profileOrb.finalScale * progress),
      );

      if (profileOrb.orbitA) {
        const [x, y, z] = profileOrb.orbitA.finalRotation;
        profileOrb.orbitA.object.rotation.set(
          x,
          y - PROFILE_ORBIT_A_SWEEP * (1 - progress),
          z,
        );
      }
      if (profileOrb.orbitB) {
        const [x, y, z] = profileOrb.orbitB.finalRotation;
        profileOrb.orbitB.object.rotation.set(
          x - PROFILE_ORBIT_B_SWEEP * (1 - progress),
          y,
          z,
        );
      }
      if (profileOrb.orbitC) {
        const [x, y, z] = profileOrb.orbitC.finalRotation;
        profileOrb.orbitC.object.rotation.set(
          x,
          y,
          z + PROFILE_ORBIT_C_SWEEP * (1 - progress),
        );
      }
    },

    restore,
  };
}

function createRingSweepMaterialHandle() {
  const material = new MeshBasicMaterial({
    color: "#e0ba67",
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  return {
    material,
    setProgress(progress: number) {
      material.opacity = Math.sin(Math.PI * progress) * 0.86;
    },
    dispose() {
      material.dispose();
    },
  };
}

export function TerritoryGenesisPass({
  plates,
  entranceState,
  onScenePhaseChange,
}: TerritoryGenesisPassProps) {
  const scene = useThree((state) => state.scene);
  const startedAtRef = useRef<number | null>(null);
  const emittedPhaseRef = useRef<CommandSceneState | null>(null);
  const completedRef = useRef(false);
  const meshRefs = useRef<Array<Mesh | null>>([]);
  const ringSweepRef = useRef<Group>(null);
  const descriptors = useMemo(
    () =>
      buildTerritoryIngressDescriptors(
        plates,
        COMMAND_ENTRANCE_RECIPE.cues.territoryIngress,
      ),
    [plates],
  );
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
  const sceneTargets = useMemo(() => createSceneTargetsController(), []);
  const ringSweep = useMemo(() => createRingSweepMaterialHandle(), []);

  useLayoutEffect(() => {
    sceneTargets.capture(scene, plates);
    sceneTargets.prime();
    return () => sceneTargets.restore();
  }, [plates, scene, sceneTargets]);

  useEffect(() => {
    if (entranceState !== "primed") return;
    startedAtRef.current = null;
    emittedPhaseRef.current = null;
    completedRef.current = false;
    sceneTargets.prime();
    ringSweep.setProgress(0);

    for (const [index, plate] of plates.entries()) {
      handles[index].setProgress(0);
      const mesh = meshRefs.current[index];
      const descriptor = descriptors.get(plate.territoryId);
      if (!mesh || !descriptor) continue;
      mesh.position.set(...descriptor.spawn);
    }
    if (ringSweepRef.current) ringSweepRef.current.rotation.z = 0;
  }, [descriptors, entranceState, handles, plates, ringSweep, sceneTargets]);

  useFrame(() => {
    if (entranceState !== "playing" || completedRef.current) return;

    const now = performance.now();
    if (startedAtRef.current === null) startedAtRef.current = now;

    const forcedProgress = readOpeningSeek(COMMAND_ENTRANCE_RECIPE.id);
    const isSeekHold = forcedProgress !== null;
    const globalProgress =
      forcedProgress ??
      resolveOpeningProgress(
        now,
        startedAtRef.current,
        COMMAND_ENTRANCE_RECIPE.durationMs,
      );

    for (const [index, plate] of plates.entries()) {
      const descriptor = descriptors.get(plate.territoryId);
      const mesh = meshRefs.current[index];
      if (!descriptor || !mesh) continue;

      const ingressProgress = sampleTerritoryIngress(globalProgress, descriptor);
      const remaining = 1 - ingressProgress;
      mesh.position.set(
        descriptor.spawn[0] * remaining,
        descriptor.spawn[1] * remaining,
        descriptor.spawn[2] * remaining,
      );
    }

    const genesisProgress = sampleContinuousOpeningCue(
      globalProgress,
      COMMAND_ENTRANCE_RECIPE.cues.genesis,
    );
    const profileProgress = sampleContinuousOpeningCue(
      globalProgress,
      COMMAND_ENTRANCE_RECIPE.cues.profileActivation,
    );

    for (const handle of handles) handle.setProgress(genesisProgress);
    sceneTargets.setGenesisProgress(genesisProgress);
    sceneTargets.setProfileProgress(profileProgress);
    ringSweep.setProgress(genesisProgress);
    if (ringSweepRef.current) {
      ringSweepRef.current.rotation.z = Math.PI * 2 * genesisProgress;
    }

    // Settling is semantic only. No second easing starts here: all visual
    // properties continue along their single monotonic curve to progress=1.
    const nextPhase: CommandSceneState = isSeekHold
      ? globalProgress >= COMMAND_ENTRANCE_RECIPE.settlingStart
        ? "settling"
        : "playing"
      : globalProgress >= 1
        ? "ready"
        : globalProgress >= COMMAND_ENTRANCE_RECIPE.settlingStart
          ? "settling"
          : "playing";

    if (nextPhase !== emittedPhaseRef.current) {
      emittedPhaseRef.current = nextPhase;
      onScenePhaseChange(nextPhase);
    }

    if (!isSeekHold && globalProgress >= 1) completedRef.current = true;
  });

  useEffect(
    () => () => {
      for (const handle of handles) handle.material.dispose();
      ringSweep.dispose();
    },
    [handles, ringSweep],
  );

  return (
    <group name="HomeGenesisPass" renderOrder={2}>
      {plates.map((plate, index) => {
        const descriptor = descriptors.get(plate.territoryId);
        const initialPosition: [number, number, number] = descriptor
          ? [...descriptor.spawn]
          : [0, 0, 0];

        return (
          <mesh
            key={`genesis-${plate.id}`}
            ref={(node) => {
              meshRefs.current[index] = node;
            }}
            geometry={plate.geometry}
            material={handles[index].material}
            position={initialPosition}
            renderOrder={2}
          />
        );
      })}

      <group
        ref={ringSweepRef}
        name="GenesisRingSweep"
        position={[GENESIS_RING_CENTER, GENESIS_RING_CENTER, 26]}
        renderOrder={3}
      >
        <mesh material={ringSweep.material} renderOrder={3}>
          <ringGeometry
            args={[
              GENESIS_RING_INNER_RADIUS,
              GENESIS_RING_OUTER_RADIUS,
              32,
              1,
              0.08,
              0.72,
            ]}
          />
        </mesh>
        <mesh material={ringSweep.material} renderOrder={3}>
          <ringGeometry
            args={[
              GENESIS_RING_INNER_RADIUS,
              GENESIS_RING_OUTER_RADIUS,
              32,
              1,
              2.2,
              0.48,
            ]}
          />
        </mesh>
        <mesh material={ringSweep.material} renderOrder={3}>
          <ringGeometry
            args={[
              GENESIS_RING_INNER_RADIUS,
              GENESIS_RING_OUTER_RADIUS,
              32,
              1,
              4.1,
              0.9,
            ]}
          />
        </mesh>
      </group>
    </group>
  );
}
