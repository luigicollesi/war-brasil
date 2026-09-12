"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import {
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  LineBasicMaterial,
  MathUtils,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector3,
} from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { COMMAND_FOUNDATION_TOKENS } from "./foundation-tokens";
import type { NormalizedCommandSceneIntent } from "./scene-contract";
import { resolveCommandCameraPose } from "./scene-presets";

const MAP_VIEWBOX_SIZE = 1254;
const MAP_SCALE = COMMAND_FOUNDATION_TOKENS.scene.mapScale;
const MAP_HALF_EXTENT = (MAP_VIEWBOX_SIZE * MAP_SCALE) / 2;
const CANONICAL_TERRITORY_COUNT = 42;
const PLATE_TONES = ["#26352a", "#2d3d30", "#223027", "#344437"] as const;

type Position3 = [number, number, number];

type SceneLayout = {
  center: Position3;
  objectScale: number;
  globePosition: Position3;
  globeScale: number;
  insigniaPosition: Position3;
  insigniaScale: number;
};

const DESKTOP_LAYOUT: SceneLayout = {
  center: [0.72, -0.28, 0],
  objectScale: 1,
  globePosition: [-2.8, 0.74, 0.15],
  globeScale: 1,
  insigniaPosition: [2.95, 1.08, 0.14],
  insigniaScale: 1,
};

const COMPACT_LAYOUT: SceneLayout = {
  center: [1.05, 0.55, 0],
  objectScale: 0.82,
  globePosition: [-1.35, 1.85, 0.15],
  globeScale: 0.72,
  insigniaPosition: [2.4, 1.65, 0.14],
  insigniaScale: 0.82,
};

type CommandSceneCanvasProps = {
  intent: NormalizedCommandSceneIntent;
  reducedMotion: boolean;
  compact: boolean;
  maxDpr: number;
  onReady: () => void;
  onUnavailable: () => void;
};

type TerritoryPlate = {
  id: string;
  territoryId: number;
  geometry: ExtrudeGeometry;
  edges: EdgesGeometry;
};

function WebGLContextGuard({ onUnavailable }: { onUnavailable: () => void }) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onUnavailable();
    };

    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    return () => canvas.removeEventListener("webglcontextlost", handleContextLost, false);
  }, [gl, onUnavailable]);

  return null;
}

function CameraDirector({
  intent,
  reducedMotion,
  compact,
}: {
  intent: NormalizedCommandSceneIntent;
  reducedMotion: boolean;
  compact: boolean;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const pose = useMemo(
    () => resolveCommandCameraPose(intent, compact),
    [compact, intent],
  );
  const desiredPosition = useMemo(() => new Vector3(...pose.camera), [pose.camera]);
  const desiredTarget = useMemo(() => new Vector3(...pose.target), [pose.target]);
  const currentTarget = useRef(desiredTarget.clone());

  useEffect(() => {
    invalidate();
  }, [desiredPosition, desiredTarget, invalidate, pose.fov, reducedMotion]);

  useFrame((state, delta) => {
    const activeCamera = state.camera;

    if (reducedMotion) {
      activeCamera.position.copy(desiredPosition);
      currentTarget.current.copy(desiredTarget);
      activeCamera.lookAt(desiredTarget);
      if (activeCamera instanceof PerspectiveCamera) {
        activeCamera.fov = pose.fov;
        activeCamera.updateProjectionMatrix();
      }
      return;
    }

    const alpha = 1 - Math.exp(-COMMAND_FOUNDATION_TOKENS.motion.cameraDamping * delta);
    activeCamera.position.lerp(desiredPosition, alpha);
    currentTarget.current.lerp(desiredTarget, alpha);
    activeCamera.lookAt(currentTarget.current);

    if (activeCamera instanceof PerspectiveCamera) {
      activeCamera.fov = MathUtils.damp(
        activeCamera.fov,
        pose.fov,
        COMMAND_FOUNDATION_TOKENS.motion.cameraDamping,
        delta,
      );
      activeCamera.updateProjectionMatrix();
    }
  });

  return null;
}

function StrategicGlobe({
  intent,
  reducedMotion,
  layout,
}: {
  intent: NormalizedCommandSceneIntent;
  reducedMotion: boolean;
  layout: SceneLayout;
}) {
  const globeRef = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const focused = intent.focus === "earth";
  const recessedPosition = useMemo<Position3>(
    () => [
      layout.globePosition[0] - (layout.globeScale < 0.9 ? 0.55 : 0.9),
      layout.globePosition[1] + 0.18,
      layout.globePosition[2] - 1.15,
    ],
    [layout.globePosition, layout.globeScale],
  );
  const targetPosition = focused ? layout.globePosition : recessedPosition;
  const targetScale = layout.globeScale * (focused ? 1 : 0.24);

  useEffect(() => {
    if (!reducedMotion || !globeRef.current) return;
    globeRef.current.position.set(...targetPosition);
    globeRef.current.scale.setScalar(targetScale);
    globeRef.current.rotation.y = 0;
    invalidate();
  }, [invalidate, reducedMotion, targetPosition, targetScale]);

  useFrame(({ clock }, delta) => {
    const globe = globeRef.current;
    if (!globe || reducedMotion) return;

    globe.position.x = MathUtils.damp(
      globe.position.x,
      targetPosition[0],
      COMMAND_FOUNDATION_TOKENS.motion.objectDamping,
      delta,
    );
    globe.position.y = MathUtils.damp(
      globe.position.y,
      targetPosition[1],
      COMMAND_FOUNDATION_TOKENS.motion.objectDamping,
      delta,
    );
    globe.position.z = MathUtils.damp(
      globe.position.z,
      targetPosition[2],
      COMMAND_FOUNDATION_TOKENS.motion.objectDamping,
      delta,
    );
    const scale = MathUtils.damp(
      globe.scale.x,
      targetScale,
      COMMAND_FOUNDATION_TOKENS.motion.objectDamping,
      delta,
    );
    globe.scale.setScalar(scale);
    globe.rotation.y = focused
      ? clock.getElapsedTime() * 0.025
      : MathUtils.damp(
          globe.rotation.y,
          0.18,
          COMMAND_FOUNDATION_TOKENS.motion.objectDamping,
          delta,
        );
  });

  return (
    <group
      ref={globeRef}
      name="StrategicGlobe"
      position={targetPosition}
      scale={targetScale}
    >
      <mesh>
        <sphereGeometry args={[1.26, 28, 20]} />
        <meshStandardMaterial
          color="#1c2c22"
          roughness={0.68}
          metalness={0.18}
          transparent
          opacity={0.46}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.285, 20, 14]} />
        <meshBasicMaterial color="#b28c48" wireframe transparent opacity={0.19} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.42, 0.012, 6, 72]} />
        <meshBasicMaterial color="#c9a459" transparent opacity={0.44} />
      </mesh>
      <mesh rotation={[0.22, 0.15, 0]}>
        <torusGeometry args={[1.5, 0.01, 6, 72]} />
        <meshBasicMaterial color="#776238" transparent opacity={0.31} />
      </mesh>
    </group>
  );
}

function DomainTable({ layout }: { layout: SceneLayout }) {
  return (
    <group
      name="DomainTable"
      position={[layout.center[0], layout.center[1], -0.38]}
      scale={layout.objectScale}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[4.58, 4.76, 0.34, 96]} />
        <meshStandardMaterial color="#101713" roughness={0.75} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.18]}>
        <ringGeometry args={[4.42, 4.54, 96]} />
        <meshStandardMaterial
          color="#98763c"
          roughness={0.4}
          metalness={COMMAND_FOUNDATION_TOKENS.material.brassMetalness}
        />
      </mesh>
      <mesh position={[0, 0, 0.17]}>
        <circleGeometry args={[4.4, 96]} />
        <meshStandardMaterial color="#151e18" roughness={0.84} metalness={0.16} />
      </mesh>
    </group>
  );
}

function readCanonicalTerritoryId(
  path: { userData?: Record<string, unknown> },
  pathIndex: number,
) {
  const node = path.userData?.node as SVGElement | undefined;
  const rawId = node?.getAttribute("data-id");
  const territoryId = Number(rawId);

  if (
    !Number.isInteger(territoryId) ||
    territoryId < 1 ||
    territoryId > CANONICAL_TERRITORY_COUNT
  ) {
    throw new Error(
      `Território canônico inválido no path ${pathIndex + 1}: ${rawId ?? "ausente"}`,
    );
  }

  return territoryId;
}

function BrazilTerritoryAssembly({
  intent,
  layout,
  reducedMotion,
  onReady,
}: {
  intent: NormalizedCommandSceneIntent;
  layout: SceneLayout;
  reducedMotion: boolean;
  onReady: () => void;
}) {
  const svg = useLoader(SVGLoader, "/war-brasil-42.production.svg");
  const plateRefs = useRef<Array<Group | null>>([]);
  const invalidate = useThree((state) => state.invalidate);
  const materials = useMemo(
    () =>
      PLATE_TONES.map(
        (color) =>
          new MeshStandardMaterial({
            color,
            roughness: COMMAND_FOUNDATION_TOKENS.material.plateRoughness,
            metalness: COMMAND_FOUNDATION_TOKENS.material.plateMetalness,
          }),
      ),
    [],
  );
  const edgeMaterial = useMemo(
    () =>
      new LineBasicMaterial({
        color: "#d0aa57",
        transparent: true,
        opacity: 0.78,
      }),
    [],
  );

  const plates = useMemo<TerritoryPlate[]>(() => {
    const territoryIds = svg.paths.map(readCanonicalTerritoryId);
    const uniqueIds = new Set(territoryIds);

    if (
      territoryIds.length !== CANONICAL_TERRITORY_COUNT ||
      uniqueIds.size !== CANONICAL_TERRITORY_COUNT ||
      !Array.from({ length: CANONICAL_TERRITORY_COUNT }, (_, index) => index + 1).every((id) =>
        uniqueIds.has(id),
      )
    ) {
      throw new Error(
        "O mapa da Foundation deve conter exatamente os territórios canônicos 1–42.",
      );
    }

    return svg.paths.flatMap((path, pathIndex) => {
      const territoryId = territoryIds[pathIndex];

      return path.toShapes().map((shape, shapeIndex) => {
        const geometry = new ExtrudeGeometry(shape, {
          depth: 14,
          bevelEnabled: true,
          bevelThickness: 2.2,
          bevelSize: 1.3,
          bevelSegments: 1,
          curveSegments: 5,
        });
        geometry.computeVertexNormals();

        return {
          id: `${territoryId}-${shapeIndex}`,
          territoryId,
          geometry,
          edges: new EdgesGeometry(geometry, 30),
        };
      });
    });
  }, [svg]);

  useEffect(() => {
    onReady();
  }, [onReady, plates]);

  useEffect(() => {
    if (!reducedMotion) return;
    for (const [plateIndex, plate] of plates.entries()) {
      const group = plateRefs.current[plateIndex];
      if (!group) continue;
      const territoryIndex = plate.territoryId - 1;
      group.position.z = intent.territoryExplode * ((territoryIndex % 3) * 2.1);
    }
    invalidate();
  }, [intent.territoryExplode, invalidate, plates, reducedMotion]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    for (const [plateIndex, plate] of plates.entries()) {
      const group = plateRefs.current[plateIndex];
      if (!group) continue;
      const territoryIndex = plate.territoryId - 1;
      const targetSeparation = intent.territoryExplode * ((territoryIndex % 3) * 2.1);
      group.position.z = MathUtils.damp(
        group.position.z,
        targetSeparation,
        COMMAND_FOUNDATION_TOKENS.motion.objectDamping,
        delta,
      );
    }
  });

  useEffect(() => {
    return () => {
      for (const plate of plates) {
        plate.geometry.dispose();
        plate.edges.dispose();
      }
      for (const material of materials) material.dispose();
      edgeMaterial.dispose();
    };
  }, [edgeMaterial, materials, plates]);

  return (
    <group
      name="BrazilTerritoryAssembly"
      position={[layout.center[0], layout.center[1], 0.08]}
      rotation={[-0.095, 0.035, -0.028]}
      scale={layout.objectScale}
    >
      <group
        scale={[MAP_SCALE, -MAP_SCALE, MAP_SCALE]}
        position={[-MAP_HALF_EXTENT, MAP_HALF_EXTENT, 0]}
      >
        {plates.map((plate, plateIndex) => {
          const territoryIndex = plate.territoryId - 1;
          const initialSeparation = reducedMotion
            ? intent.territoryExplode * ((territoryIndex % 3) * 2.1)
            : 0;

          return (
            <group
              key={plate.id}
              ref={(node) => {
                plateRefs.current[plateIndex] = node;
              }}
              position-z={initialSeparation}
            >
              <mesh geometry={plate.geometry}>
                <primitive
                  attach="material"
                  object={materials[territoryIndex % materials.length]}
                />
              </mesh>
              <lineSegments geometry={plate.edges} material={edgeMaterial} />
            </group>
          );
        })}
      </group>
    </group>
  );
}

function OrbitalCrown({
  intent,
  reducedMotion,
  layout,
}: {
  intent: NormalizedCommandSceneIntent;
  reducedMotion: boolean;
  layout: SceneLayout;
}) {
  const territoryRef = useRef<Group>(null);
  const commandRef = useRef<Group>(null);
  const conflictRef = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!reducedMotion) return;
    const aligned = intent.orbitalAlignment === 1;

    if (territoryRef.current) territoryRef.current.rotation.z = 0;
    if (commandRef.current) commandRef.current.rotation.z = aligned ? 0 : 0.08;
    if (conflictRef.current) conflictRef.current.rotation.z = aligned ? 0 : -0.11;
    invalidate();
  }, [intent.orbitalAlignment, invalidate, reducedMotion]);

  useFrame(({ clock }, delta) => {
    if (reducedMotion) return;
    const elapsed = clock.getElapsedTime();
    const aligned = intent.orbitalAlignment === 1;
    const baseSpeed = COMMAND_FOUNDATION_TOKENS.motion.crownTurnsPerSecond * Math.PI * 2;
    const damping = COMMAND_FOUNDATION_TOKENS.motion.objectDamping;

    if (territoryRef.current) {
      territoryRef.current.rotation.z = MathUtils.damp(
        territoryRef.current.rotation.z,
        aligned ? 0 : elapsed * baseSpeed,
        damping,
        delta,
      );
    }
    if (commandRef.current) {
      commandRef.current.rotation.z = MathUtils.damp(
        commandRef.current.rotation.z,
        aligned ? 0 : 0.08 - elapsed * baseSpeed * 0.72,
        damping,
        delta,
      );
    }
    if (conflictRef.current) {
      conflictRef.current.rotation.z = MathUtils.damp(
        conflictRef.current.rotation.z,
        aligned ? 0 : -0.11 + elapsed * baseSpeed * 0.48,
        damping,
        delta,
      );
    }
  });

  const conflictOpacity = 0.08 + intent.conflictLevel * 0.13;

  return (
    <group
      name="OrbitalCrown"
      position={layout.center}
      scale={layout.objectScale}
    >
      <group ref={territoryRef} name="OrbitalCrown-Territory" rotation={[0.04, 0.08, 0]}>
        <mesh>
          <torusGeometry args={[4.02, 0.021, 8, 128]} />
          <meshStandardMaterial
            color="#61745f"
            metalness={0.7}
            roughness={0.42}
            transparent
            opacity={0.7}
          />
        </mesh>
      </group>
      <group ref={commandRef} name="OrbitalCrown-Command" rotation={[-0.12, 0.18, 0.08]}>
        <mesh>
          <torusGeometry args={[4.26, 0.016, 8, 128]} />
          <meshStandardMaterial
            color="#d0aa57"
            metalness={0.82}
            roughness={0.34}
            transparent
            opacity={0.62}
          />
        </mesh>
      </group>
      <group ref={conflictRef} name="OrbitalCrown-Conflict" rotation={[0.17, -0.14, -0.11]}>
        <mesh>
          <torusGeometry args={[4.48, 0.014, 8, 128]} />
          <meshStandardMaterial
            color="#a52b31"
            emissive="#611318"
            emissiveIntensity={0.25 + intent.conflictLevel * 0.18}
            metalness={0.74}
            roughness={0.39}
            transparent
            opacity={conflictOpacity}
          />
        </mesh>
      </group>
    </group>
  );
}

function SceneInsignia({
  intent,
  reducedMotion,
  layout,
}: {
  intent: NormalizedCommandSceneIntent;
  reducedMotion: boolean;
  layout: SceneLayout;
}) {
  const insigniaRef = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const emphasized = intent.mode === "profile" || intent.focus === "insignia";
  const targetScale = layout.insigniaScale * (emphasized ? 1 : 0.72);
  const baseScale = layout.insigniaScale * 0.72;

  useEffect(() => {
    if (!reducedMotion || !insigniaRef.current) return;
    insigniaRef.current.scale.setScalar(targetScale);
    invalidate();
  }, [invalidate, reducedMotion, targetScale]);

  useFrame((_, delta) => {
    if (reducedMotion || !insigniaRef.current) return;
    const scale = MathUtils.damp(
      insigniaRef.current.scale.x,
      targetScale,
      COMMAND_FOUNDATION_TOKENS.motion.objectDamping,
      delta,
    );
    insigniaRef.current.scale.setScalar(scale);
  });

  return (
    <group
      ref={insigniaRef}
      name="CommandInsignia"
      position={layout.insigniaPosition}
      scale={baseScale}
    >
      <mesh>
        <cylinderGeometry args={[0.48, 0.48, 0.08, 32]} />
        <meshStandardMaterial color="#242f27" metalness={0.58} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0, 0.055]}>
        <torusGeometry args={[0.34, 0.025, 8, 48]} />
        <meshStandardMaterial color="#c49a4b" metalness={0.82} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[0.34, 0.055, 0.035]} />
        <meshStandardMaterial color="#eee8da" metalness={0.18} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.071]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.22, 0.055, 0.035]} />
        <meshStandardMaterial color="#eee8da" metalness={0.18} roughness={0.5} />
      </mesh>
    </group>
  );
}

function ArchitecturalRails({ compact }: { compact: boolean }) {
  if (compact) return null;

  return (
    <group name="CommandArchitecture" position={[0, 0, -0.55]}>
      <mesh position={[5.05, -1.4, 0]}>
        <boxGeometry args={[0.035, 3.8, 0.12]} />
        <meshStandardMaterial color="#7f6638" metalness={0.72} roughness={0.46} />
      </mesh>
      <mesh position={[-4.85, 2.65, -0.08]}>
        <boxGeometry args={[2.35, 0.025, 0.1]} />
        <meshStandardMaterial color="#4a4c3c" metalness={0.55} roughness={0.58} />
      </mesh>
      <mesh position={[4.4, 2.72, -0.12]}>
        <boxGeometry args={[1.35, 0.018, 0.08]} />
        <meshStandardMaterial color="#5f573d" metalness={0.58} roughness={0.55} />
      </mesh>
    </group>
  );
}

function SceneFallbackGeometry({ layout }: { layout: SceneLayout }) {
  return (
    <mesh
      position={[layout.center[0], layout.center[1], 0]}
      scale={layout.objectScale}
    >
      <ringGeometry args={[3.75, 3.78, 96]} />
      <meshBasicMaterial color="#876d3f" transparent opacity={0.28} />
    </mesh>
  );
}

function CommandSceneWorld({
  intent,
  reducedMotion,
  compact,
  onReady,
}: {
  intent: NormalizedCommandSceneIntent;
  reducedMotion: boolean;
  compact: boolean;
  onReady: () => void;
}) {
  const layout = compact ? COMPACT_LAYOUT : DESKTOP_LAYOUT;
  const conflictIntensity = intent.conflictLevel * 5.2;

  return (
    <>
      <CameraDirector
        intent={intent}
        reducedMotion={reducedMotion}
        compact={compact}
      />
      <ambientLight color="#869187" intensity={1.15} />
      <directionalLight color="#eee1c2" intensity={2.35} position={[-5, 5, 8]} />
      <pointLight color="#c18f4c" intensity={18} distance={14} position={[5.4, 3.2, 5]} />
      <pointLight
        color="#9e242b"
        intensity={conflictIntensity}
        distance={9}
        position={[-3.8, -2.8, 3.3]}
      />

      <ArchitecturalRails compact={compact} />
      <DomainTable layout={layout} />
      <OrbitalCrown
        intent={intent}
        reducedMotion={reducedMotion}
        layout={layout}
      />
      <SceneInsignia
        intent={intent}
        reducedMotion={reducedMotion}
        layout={layout}
      />
      <StrategicGlobe
        intent={intent}
        reducedMotion={reducedMotion}
        layout={layout}
      />
      <Suspense fallback={<SceneFallbackGeometry layout={layout} />}>
        <BrazilTerritoryAssembly
          intent={intent}
          layout={layout}
          reducedMotion={reducedMotion}
          onReady={onReady}
        />
      </Suspense>
    </>
  );
}

export function CommandSceneCanvas({
  intent,
  reducedMotion,
  compact,
  maxDpr,
  onReady,
  onUnavailable,
}: CommandSceneCanvasProps) {
  const initialPose = resolveCommandCameraPose(intent, compact);

  return (
    <Canvas
      className="command-foundation-canvas"
      camera={{
        position: [
          initialPose.camera[0],
          initialPose.camera[1],
          initialPose.camera[2],
        ],
        fov: initialPose.fov,
        near: 0.1,
        far: 40,
      }}
      dpr={[1, maxDpr]}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{
        antialias: maxDpr > 1.05,
        alpha: false,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(COMMAND_FOUNDATION_TOKENS.color.void, 1);
      }}
    >
      <fog attach="fog" args={[COMMAND_FOUNDATION_TOKENS.color.void, 11.5, 19]} />
      <WebGLContextGuard onUnavailable={onUnavailable} />
      <CommandSceneWorld
        intent={intent}
        reducedMotion={reducedMotion}
        compact={compact}
        onReady={onReady}
      />
    </Canvas>
  );
}
