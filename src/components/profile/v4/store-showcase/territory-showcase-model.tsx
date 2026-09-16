"use client";

import { useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import {
  ClampToEdgeWrapping,
  DoubleSide,
  EdgesGeometry,
  LineBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import {
  SHOWCASE_TERRITORY_ELEMENT_ID,
  SHOWCASE_TERRITORY_SVG,
} from "@/src/lib/client/store-showcase/territory-showcase-config";
import { createTerritoryShowcaseGeometry } from "@/src/lib/client/store-showcase/territory-showcase-geometry";
import { resolveTerritoryShowcaseSkin } from "@/src/lib/client/store-showcase/territory-showcase-skin";

export type TerritoryShowcaseModelProps = Readonly<{
  cosmeticId: string;
  assetRef: string | null;
  effectKey: string | null;
}>;

function canonicalNode(path: { userData?: Record<string, unknown> }) {
  return path.userData?.node as SVGElement | undefined;
}

function useSafeTerritorySkinTexture(skinAssetRef: string | null) {
  const invalidate = useThree((state) => state.invalidate);
  const [loaded, setLoaded] = useState<{
    assetRef: string | null;
    texture: Texture | null;
  }>({ assetRef: null, texture: null });

  useEffect(() => {
    if (!skinAssetRef) return;

    let active = true;
    const loader = new TextureLoader();
    const pendingTexture = loader.load(
      skinAssetRef,
      (texture) => {
        texture.colorSpace = SRGBColorSpace;
        texture.wrapS = ClampToEdgeWrapping;
        texture.wrapT = ClampToEdgeWrapping;
        texture.needsUpdate = true;

        if (!active) {
          texture.dispose();
          return;
        }

        setLoaded({ assetRef: skinAssetRef, texture });
        invalidate();
      },
      undefined,
      () => {
        if (!active) return;
        setLoaded({ assetRef: skinAssetRef, texture: null });
        invalidate();
      },
    );

    return () => {
      active = false;
      pendingTexture.dispose();
    };
  }, [invalidate, skinAssetRef]);

  if (!skinAssetRef || loaded.assetRef !== skinAssetRef) return null;
  return loaded.texture;
}

function applyLuminositySkin(
  material: MeshStandardMaterial,
  skinOpacity: number,
) {
  material.customProgramCacheKey = () => `store-territory-luminosity-${skinOpacity}`;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  float skinLuminance = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float skinGain = mix(1.0, clamp(0.34 + skinLuminance * 1.18, 0.34, 1.42), ${skinOpacity.toFixed(2)});
  diffuseColor.rgb *= skinGain;
  diffuseColor.a *= sampledDiffuseColor.a;
#endif
      `,
    );
  };
}

export function TerritoryShowcaseModel({
  cosmeticId,
  assetRef,
  effectKey,
}: TerritoryShowcaseModelProps) {
  const svg = useLoader(SVGLoader, SHOWCASE_TERRITORY_SVG);
  const visual = useMemo(
    () => resolveTerritoryShowcaseSkin({ cosmeticId, assetRef, effectKey }),
    [assetRef, cosmeticId, effectKey],
  );
  const skinTexture = useSafeTerritorySkinTexture(visual.skinAssetRef);
  const canonicalPath = useMemo(
    () =>
      svg.paths.find((path) => canonicalNode(path)?.id === SHOWCASE_TERRITORY_ELEMENT_ID) ??
      null,
    [svg.paths],
  );

  const geometrySet = useMemo(() => {
    if (!canonicalPath) {
      throw new Error(
        `Canonical showcase territory ${SHOWCASE_TERRITORY_ELEMENT_ID} was not found.`,
      );
    }

    return createTerritoryShowcaseGeometry(canonicalPath.toShapes());
  }, [canonicalPath]);

  const edgeGeometries = useMemo(
    () => geometrySet.geometries.map((geometry) => new EdgesGeometry(geometry, 28)),
    [geometrySet.geometries],
  );
  const frontMaterial = useMemo(() => {
    const material = new MeshStandardMaterial({
      color: visual.frontColor,
      map: skinTexture,
      roughness: skinTexture ? 0.54 : 0.62,
      metalness: skinTexture ? 0.2 : 0.28,
      side: DoubleSide,
    });
    if (skinTexture) applyLuminositySkin(material, visual.skinOpacity);
    return material;
  }, [skinTexture, visual.frontColor, visual.skinOpacity]);
  const sideMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: visual.sideColor,
        roughness: 0.72,
        metalness: 0.28,
        side: DoubleSide,
      }),
    [visual.sideColor],
  );
  const rimMaterial = useMemo(
    () =>
      new LineBasicMaterial({
        color: visual.rimColor,
        transparent: true,
        opacity: 0.92,
      }),
    [visual.rimColor],
  );

  useEffect(
    () => () => {
      for (const geometry of geometrySet.geometries) geometry.dispose();
      for (const geometry of edgeGeometries) geometry.dispose();
    },
    [edgeGeometries, geometrySet.geometries],
  );

  useEffect(
    () => () => {
      frontMaterial.dispose();
      sideMaterial.dispose();
      rimMaterial.dispose();
    },
    [frontMaterial, rimMaterial, sideMaterial],
  );

  return (
    <group name="StoreShowcaseTerritory" position={[0, 0.12, 0]}>
      {geometrySet.geometries.map((geometry, index) => (
        <group key={`${SHOWCASE_TERRITORY_ELEMENT_ID}-${index}`}>
          <mesh
            geometry={geometry}
            material={[frontMaterial, sideMaterial]}
            castShadow={false}
            receiveShadow={false}
          />
          <lineSegments geometry={edgeGeometries[index]} material={rimMaterial} />
        </group>
      ))}
    </group>
  );
}
