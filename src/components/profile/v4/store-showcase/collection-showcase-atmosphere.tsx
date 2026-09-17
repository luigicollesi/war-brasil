"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three";

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");
  if (!context) return null;

  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255, 236, 184, 0.92)");
  gradient.addColorStop(0.18, "rgba(229, 185, 94, 0.58)");
  gradient.addColorStop(0.42, "rgba(198, 155, 75, 0.26)");
  gradient.addColorStop(0.68, "rgba(124, 160, 111, 0.1)");
  gradient.addColorStop(1, "rgba(124, 160, 111, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function CollectionShowcaseAtmosphere({
  backgroundRef,
}: {
  backgroundRef: string | null;
}) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const [backgroundTexture, setBackgroundTexture] = useState<Texture | null>(null);
  const glowTexture = useMemo(() => createGlowTexture(), []);

  useEffect(() => {
    return () => glowTexture?.dispose();
  }, [glowTexture]);

  useEffect(() => {
    const previousBackground = scene.background;
    setBackgroundTexture(null);

    if (!backgroundRef) {
      scene.background = previousBackground;
      invalidate();
      return undefined;
    }

    let active = true;
    let loadedTexture: Texture | null = null;
    const loader = new TextureLoader();

    loader.load(
      backgroundRef,
      (texture) => {
        loadedTexture = texture;
        texture.colorSpace = SRGBColorSpace;
        texture.wrapS = ClampToEdgeWrapping;
        texture.wrapT = ClampToEdgeWrapping;
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.needsUpdate = true;

        if (!active) {
          texture.dispose();
          return;
        }

        setBackgroundTexture(texture);
        scene.background = texture;
        invalidate();
      },
      undefined,
      () => {
        if (!active) return;
        setBackgroundTexture(null);
        scene.background = previousBackground;
        invalidate();
      },
    );

    return () => {
      active = false;
      if (scene.background === loadedTexture) {
        scene.background = previousBackground;
      }
      loadedTexture?.dispose();
      invalidate();
    };
  }, [backgroundRef, invalidate, scene]);

  useEffect(() => {
    if (!backgroundTexture) return;

    const image = backgroundTexture.image as {
      width?: number;
      height?: number;
    };
    const imageWidth = image.width ?? 0;
    const imageHeight = image.height ?? 0;
    if (!imageWidth || !imageHeight || !size.width || !size.height) return;

    const imageAspect = imageWidth / imageHeight;
    const viewAspect = size.width / size.height;

    backgroundTexture.repeat.set(1, 1);
    backgroundTexture.offset.set(0, 0);

    if (imageAspect > viewAspect) {
      const visibleWidth = viewAspect / imageAspect;
      backgroundTexture.repeat.x = visibleWidth;
      backgroundTexture.offset.x = (1 - visibleWidth) / 2;
    } else {
      const visibleHeight = imageAspect / viewAspect;
      backgroundTexture.repeat.y = visibleHeight;
      backgroundTexture.offset.y = (1 - visibleHeight) / 2;
    }

    backgroundTexture.needsUpdate = true;
    invalidate();
  }, [backgroundTexture, invalidate, size.height, size.width]);

  return (
    <group name="CollectionShowcaseRearLighting" position={[0, 0.16, -1.62]}>
      <pointLight
        color="#dfb45a"
        intensity={13}
        distance={5.4}
        decay={2}
        position={[0, 0.05, 0.12]}
      />

      {glowTexture ? (
        <sprite
          name="CollectionShowcaseRearGlow"
          scale={[4.5, 4.5, 1]}
          renderOrder={-10}
          raycast={() => undefined}
        >
          <spriteMaterial
            map={glowTexture}
            color="#fff4d1"
            transparent
            opacity={0.68}
            depthTest
            depthWrite={false}
            toneMapped={false}
            blending={AdditiveBlending}
          />
        </sprite>
      ) : null}
    </group>
  );
}
