"use client";

import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { DoubleSide, MeshStandardMaterial } from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import {
  SHOWCASE_TERRITORY_ELEMENT_ID,
  SHOWCASE_TERRITORY_SVG,
} from "@/src/lib/client/store-showcase/territory-showcase-config";
import { createTerritoryShowcaseGeometry } from "@/src/lib/client/store-showcase/territory-showcase-geometry";

function canonicalNode(path: { userData?: Record<string, unknown> }) {
  return path.userData?.node as SVGElement | undefined;
}

export function TerritoryShowcaseModel() {
  const svg = useLoader(SVGLoader, SHOWCASE_TERRITORY_SVG);
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

  const frontMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#c9cec8",
        roughness: 0.48,
        metalness: 0.52,
        side: DoubleSide,
      }),
    [],
  );
  const sideMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#343a36",
        roughness: 0.7,
        metalness: 0.34,
        side: DoubleSide,
      }),
    [],
  );

  useEffect(
    () => () => {
      for (const geometry of geometrySet.geometries) geometry.dispose();
    },
    [geometrySet.geometries],
  );

  useEffect(
    () => () => {
      frontMaterial.dispose();
      sideMaterial.dispose();
    },
    [frontMaterial, sideMaterial],
  );

  return (
    <group name="StoreShowcaseTerritory" position={[0, 0.12, 0]}>
      {geometrySet.geometries.map((geometry, index) => (
        <mesh
          key={`${SHOWCASE_TERRITORY_ELEMENT_ID}-${index}`}
          geometry={geometry}
          material={[frontMaterial, sideMaterial]}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}
