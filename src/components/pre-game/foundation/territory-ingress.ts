import { Box3, Vector2, Vector3, type BufferGeometry } from "three";
import type { OpeningCueWindow } from "./opening-timeline";
import {
  deterministicOpeningSeed,
  smootherOpeningProgress,
} from "./opening-timeline";

export type TerritoryIngressSource = Readonly<{
  territoryId: number;
  geometry: BufferGeometry;
}>;

export type TerritoryIngressDescriptor = Readonly<{
  territoryId: number;
  radialRank: number;
  start: number;
  end: number;
  spawn: readonly [number, number, number];
}>;

function geometryBounds(geometry: BufferGeometry) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  if (!geometry.boundingBox) {
    throw new Error("Geometria territorial sem bounding box durante Genesis.");
  }
  return geometry.boundingBox;
}

export function buildTerritoryIngressDescriptors(
  plates: readonly TerritoryIngressSource[],
  cue: OpeningCueWindow,
) {
  const overallBounds = new Box3();
  const territoryBounds = new Map<number, Box3>();

  for (const plate of plates) {
    const bounds = geometryBounds(plate.geometry);
    overallBounds.union(bounds);

    const existing = territoryBounds.get(plate.territoryId);
    if (existing) existing.union(bounds);
    else territoryBounds.set(plate.territoryId, bounds.clone());
  }

  const mapCenter3 = overallBounds.getCenter(new Vector3());
  const mapSize3 = overallBounds.getSize(new Vector3());
  const mapCenter = new Vector2(mapCenter3.x, mapCenter3.y);
  const mapDiagonal = Math.hypot(mapSize3.x, mapSize3.y);

  const centers = new Map<number, Vector2>();
  let maxRadialDistance = 0;

  for (const [territoryId, bounds] of territoryBounds) {
    const center3 = bounds.getCenter(new Vector3());
    const center = new Vector2(center3.x, center3.y);
    centers.set(territoryId, center);
    maxRadialDistance = Math.max(maxRadialDistance, center.distanceTo(mapCenter));
  }

  const cueSpan = Math.max(cue.end - cue.start, Number.EPSILON);
  const startSpread = cueSpan * 0.32;
  const flightDuration = cueSpan - startSpread;
  const descriptors = new Map<number, TerritoryIngressDescriptor>();

  for (const [territoryId, bounds] of territoryBounds) {
    const center = centers.get(territoryId);
    if (!center) continue;

    const radialDistance = center.distanceTo(mapCenter);
    const radialRank = maxRadialDistance > Number.EPSILON
      ? radialDistance / maxRadialDistance
      : 0;
    const direction = center.clone().sub(mapCenter);

    if (direction.lengthSq() <= Number.EPSILON) {
      const angle = deterministicOpeningSeed(territoryId) * Math.PI * 2;
      direction.set(Math.cos(angle), Math.sin(angle));
    } else {
      direction.normalize();
    }

    const territorySize = bounds.getSize(new Vector3());
    const territoryRadius = Math.hypot(territorySize.x, territorySize.y) * 0.5;
    const spawnDistance =
      mapDiagonal * (1.05 + radialRank * 0.16) + territoryRadius;
    const seed = deterministicOpeningSeed(territoryId);
    const start =
      cue.start + Math.pow(radialRank, 1.35) * startSpread;

    descriptors.set(territoryId, {
      territoryId,
      radialRank,
      start,
      end: Math.min(cue.end, start + flightDuration),
      spawn: [
        direction.x * spawnDistance,
        direction.y * spawnDistance,
        32 + seed * 36,
      ],
    });
  }

  return descriptors;
}

export function sampleTerritoryIngress(
  progress: number,
  descriptor: TerritoryIngressDescriptor,
) {
  const span = Math.max(descriptor.end - descriptor.start, Number.EPSILON);
  return smootherOpeningProgress((progress - descriptor.start) / span);
}
