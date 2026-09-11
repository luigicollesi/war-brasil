"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
} from "react";
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
const MAP_CENTER_X = 0.72;
const MAP_CENTER_Y = -0.28;
const PLATE_TONES = ["#26352a", "#2d3d30", "#223027", "#344437"] as const;

type CommandSceneCanvasProps = {
  intent: NormalizedCommandSceneIntent;
  reducedMotion: boolean;
  maxDpr: number;
  onReady: () => void;
  onUnavailable: () => void;
};

type TerritoryPlate = {
  id: string;
  territoryIndex: number;
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
}: {
  intent: NormalizedCommandSceneIntent;
  reducedMotion: boolean;
}) {
  const { camera, invalidate } = useThree();
  const pose = useMemo(() => resolveCommandCameraPose(intent), [intent]);
  const desiredPosition = useMemo(() => new Vector3(...pose.camera), [pose.camera]);
  const desiredTarget = useMemo(() => new Vector3(...pose.target), [pose.target]);
  const currentTarget = useRef(desiredTarget.clone());

  useEffect(() => {
    if (!reducedMotion) return;
    camera.position.copy(desiredPosition);
    currentTarget.current.copy(desiredTarget);
    camera.lookAt(desiredTarget);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [camera, desiredPosition, desiredTarget, invalidate, pose.fov, reducedMotion]);

  useFrame((_, delta) => {
    if (reducedMotion) return;

    const alpha = 1 - Math.exp(-COMMAND_FOUNDATION_TOKENS.motion.cameraDamping * delta);
    camera.position.lerp(desiredPosition, alpha);
    currentTarget.current.lerp(desiredTarget, alpha);
    camera.lookAt(currentTarget.current);

    if (camera instanceof PerspectiveCamera) {
      camera.fov = MathUtils.damp(
        camera.fov,
        pose.fov,
        COMMAND_FOUNDATION_TOKENS.motion.cameraDamping,
        delta,
      );
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function StrategicGlobe({
  intent,
  reducedMotion,
}: {
  intent: NormalizedCommandSceneIntent;
  reducedMotion: boolean;
}) {
  const globeRef = useRef<Group>(null);
  const visible = intent.mode === "entrance" || intent.focus === "earth";

  useFrame(({ clock }) => {
    if (!globeRef.current || reducedMotion || !visible) return;
    globeRef.current.rotation.y = clock.getElapsedTime() * 0.025;
  });

  if (!visible) return null;

  return (
    <group ref={globeRef} name="StrategicGlobe" position={[-2.8, 0.74, 0.15]}>
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

function DomainTable() {
  return (
    <group name="DomainTable" position={[MAP_CENTER_X, MAP_CENTER_Y, -0.38]}>
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

function BrazilTerritoryAssembly({
  intent,
}: {
  intent: NormalizedCommandSceneIntent;
}) {
  const svg = useLoader(SVGLoader, "/war-brasil-42.production.svg");
  const assemblyRef = useRef<Group>(null);
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
        opacity: 0.74,
      }),
    [],
  );

  const plates = useMemo<TerritoryPlate[]>(() => {
    return svg.paths.flatMap((path, pathIndex) => {
      const node = path.userData?.node as SVGElement | undefined;
      const territoryId = node?.getAttribute("data-territory-id") ?? String(pathIndex + 1);

      return SVGLoader.createShapes(path).map((shape, shapeIndex) => {
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
          territoryIndex: pathIndex,
          geometry,
          edges: new EdgesGeometry(geometry, 30),
        };
      });
    });
  }, [svg]);

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
      ref={assemblyRef}
      name="BrazilTerritoryAssembly"
      position={[MAP_CENTER_X, MAP_CENTER_Y, 0.08]}
      rotation={[-0.095, 0.035, -0.028]}
    >
      <group
        scale={[MAP_SCALE, -MAP_SCALE, MAP_SCALE]}
        position={[-MAP_HALF_EXTENT, MAP_HALF_EXTENT, 0]}
      >
        {plates.map((plate) => {
          const separation =
            intent.territoryExplode * ((plate.territoryIndex % 3) * 2.1);
          return (
            <group key={plate.id} position-z={separation}>
              <mesh geometry={plate.geometry}>
                <primitive
                  attach="material"
                  object={materials[plate.territoryIndex % materials.length]}
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
}: {
  intent: NormalizedCommandSceneIntent;
  reducedMotion: boolean;
}) {
  const territoryRef = useRef<Group>(null);
  const commandRef = useRef<Group>(null);
  const conflictRef = useRef<Group>(null);

  useEffect(() => {
    if (!reducedMotion || !intent.orbitalAlignment) return;
    for (const ref of [territoryRef, commandRef, conflictRef]) {
      if (ref.current) ref.current.rotation.z = 0;
    }
  }, [intent.orbitalAlignment, reducedMotion]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const elapsed = clock.getElapsedTime();
    const aligned = intent.orbitalAlignment === 1;
    const baseSpeed = COMMAND_FOUNDATION_TOKENS.motion.crownTurnsPerSecond * Math.PI * 2;

    if (territoryRef.current) {
      territoryRef.current.rotation.z = aligned ? 0 : elapsed * baseSpeed;
    }
    if (commandRef.current) {
      commandRef.current.rotation.z = aligned ? 0 : -elapsed * baseSpeed * 0.72;
    }
    if (conflictRef.current) {
      conflictRef.current.rotation.z = aligned ? 0 : elapsed * baseSpeed * 0.48;
    }
  });

  const conflictOpacity = 0.08 + intent.conflictLevel * 0.13;

  return (
    <group name="OrbitalCrown" position={[MAP_CENTER_X, MAP_CENTER_Y, 0.02]}>
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

function SceneInsignia({ intent }: { intent: NormalizedCommandSceneIntent }) {
  const emphasized = intent.mode === "profile" || intent.focus === "insignia";
  return (
    <group
      name="CommandInsignia"
      position={[2.95, 1.08, 0.14]}
      scale={emphasized ? 1 : 0.72}
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

function ArchitecturalRails() {
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

function SceneFallbackGeometry() {
  return (
    <mesh position={[MAP_CENTER_X, MAP_CENTER_Y, 0]}>
      <ringGeometry args={[3.75, 3.78, 96]} />
      <meshBasicMaterial color="#876d3f" transparent opacity={0.28} />
    </mesh>
  );
}

function CommandSceneWorld({
  intent,
  reducedMotion,
}: {
  intent: NormalizedCommandSceneIntent;
  reducedMotion: boolean;
}) {
  const conflictIntensity = intent.conflictLevel * 5.2;

  return (
    <>
      <CameraDirector intent={intent} reducedMotion={reducedMotion} />
      <ambientLight color="#869187" intensity={1.15} />
      <directionalLight color="#eee1c2" intensity={2.35} position={[-5, 5, 8]} />
      <pointLight color="#c18f4c" intensity={18} distance={14} position={[5.4, 3.2, 5]} />
      <pointLight
        color="#9e242b"
        intensity={conflictIntensity}
        distance={9}
        position={[-3.8, -2.8, 3.3]}
      />

      <ArchitecturalRails />
      <DomainTable />
      <OrbitalCrown intent={intent} reducedMotion={reducedMotion} />
      <SceneInsignia intent={intent} />
      <StrategicGlobe intent={intent} reducedMotion={reducedMotion} />
      <Suspense fallback={<SceneFallbackGeometry />}>
        <BrazilTerritoryAssembly intent={intent} />
      </Suspense>
    </>
  );
}

export function CommandSceneCanvas({
  intent,
  reducedMotion,
  maxDpr,
  onReady,
  onUnavailable,
}: CommandSceneCanvasProps) {
  return (
    <Canvas
      className="command-foundation-canvas"
      camera={{ position: [-0.8, 0.8, 11.7], fov: 38, near: 0.1, far: 40 }}
      dpr={[1, maxDpr]}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{
        antialias: maxDpr > 1.05,
        alpha: false,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(COMMAND_FOUNDATION_TOKENS.color.void, 1);
        onReady();
      }}
    >
      <fog attach="fog" args={[COMMAND_FOUNDATION_TOKENS.color.void, 11.5, 19]} />
      <WebGLContextGuard onUnavailable={onUnavailable} />
      <CommandSceneWorld intent={intent} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
