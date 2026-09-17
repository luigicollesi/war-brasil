"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import {
  AdditiveBlending,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Texture,
} from "three";

const BACKGROUND_Z = -5.4;

export function CollectionShowcaseAtmosphere({
  backgroundRef,
}: {
  backgroundRef: string | null;
}) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const viewport = useThree((state) => state.viewport);
  const [backgroundTexture, setBackgroundTexture] = useState<Texture | null>(null);

  const backgroundTarget = useMemo(
    () => new Vector3(camera.position.x, 0, BACKGROUND_Z),
    [camera.position.x],
  );
  const backgroundViewport = viewport.getCurrentViewport(
    camera,
    backgroundTarget,
    size,
  );

  useEffect(() => {
    setBackgroundTexture(null);
    if (!backgroundRef) return undefined;

    let active = true;
    let loadedTexture: Texture | null = null;
    const loader = new TextureLoader();

    loader.load(
      backgroundRef,
      (texture) => {
        loadedTexture = texture;
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
        if (!active) {
          texture.dispose();
          return;
        }
        setBackgroundTexture(texture);
        invalidate();
      },
      undefined,
      () => {
        if (active) setBackgroundTexture(null);
      },
    );

    return () => {
      active = false;
      loadedTexture?.dispose();
    };
  }, [backgroundRef, invalidate]);

  return (
    <>
      {backgroundTexture ? (
        <mesh
          name="CollectionShowcaseBackground"
          position={[0, 0, BACKGROUND_Z]}
          renderOrder={-30}
          frustumCulled={false}
          raycast={() => undefined}
        >
          <planeGeometry
            args={[
              backgroundViewport.width * 1.08,
              backgroundViewport.height * 1.08,
            ]}
          />
          <meshBasicMaterial
            map={backgroundTexture}
            transparent
            opacity={0.76}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}

      <group name="CollectionShowcaseRearGlow" position={[0, 0.12, -1.72]}>
        <pointLight color="#e1b65b" intensity={28} distance={7.2} decay={2} />
        <mesh
          scale={[1.75, 1.75, 0.34]}
          renderOrder={-12}
          raycast={() => undefined}
        >
          <sphereGeometry args={[1, 48, 32]} />
          <meshBasicMaterial
            color="#e5b95d"
            transparent
            opacity={0.12}
            depthWrite={false}
            toneMapped={false}
            blending={AdditiveBlending}
          />
        </mesh>
        <mesh
          scale={[2.65, 2.65, 0.24]}
          renderOrder={-13}
          raycast={() => undefined}
        >
          <sphereGeometry args={[1, 48, 32]} />
          <meshBasicMaterial
            color="#8dad79"
            transparent
            opacity={0.055}
            depthWrite={false}
            toneMapped={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
    </>
  );
}
