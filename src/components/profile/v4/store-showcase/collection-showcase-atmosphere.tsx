"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

function cssBackgroundImage(assetRef: string) {
  return `url(${JSON.stringify(assetRef)})`;
}

export function CollectionShowcaseAtmosphere({
  backgroundRef,
}: {
  backgroundRef: string | null;
}) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const host = gl.domElement.closest("[data-command-scene]") as HTMLElement | null;
    if (!host || !backgroundRef) return undefined;

    const previous = {
      backgroundImage: host.style.backgroundImage,
      backgroundPosition: host.style.backgroundPosition,
      backgroundRepeat: host.style.backgroundRepeat,
      backgroundSize: host.style.backgroundSize,
    };

    host.style.backgroundImage = cssBackgroundImage(backgroundRef);
    host.style.backgroundPosition = "center";
    host.style.backgroundRepeat = "no-repeat";
    host.style.backgroundSize = "cover";
    host.dataset.collectionBackdrop = "true";

    return () => {
      host.style.backgroundImage = previous.backgroundImage;
      host.style.backgroundPosition = previous.backgroundPosition;
      host.style.backgroundRepeat = previous.backgroundRepeat;
      host.style.backgroundSize = previous.backgroundSize;
      delete host.dataset.collectionBackdrop;
    };
  }, [backgroundRef, gl]);

  useEffect(() => {
    invalidate();
  }, [invalidate]);

  return (
    <group name="CollectionShowcaseRearLighting" position={[0, 0.16, -1.62]}>
      <pointLight
        color="#dfb45a"
        intensity={11}
        distance={5.2}
        decay={2}
        position={[0, 0.05, 0.12]}
      />
    </group>
  );
}
