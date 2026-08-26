"use client";

import { useMemo } from "react";
import type { TerritoryAnchor } from "@/src/components/territory-arrow";
import { createRoadCurve } from "@/src/lib/road-geometry";
import { roadsFromConnections } from "@/src/lib/road-network";
import type { TerritoryConnection } from "@/src/lib/territory-connections";

type RoadNetworkProps = {
  connections: TerritoryConnection[];
  anchors: Map<number, TerritoryAnchor>;
  visible: boolean;
  selectedTerritoryId?: number | null;
  targetTerritoryIds?: number[];
};

export function RoadNetwork({
  connections,
  anchors,
  visible,
  selectedTerritoryId = null,
  targetTerritoryIds = [],
}: RoadNetworkProps) {
  const targetIds = useMemo(
    () => new Set(targetTerritoryIds),
    [targetTerritoryIds],
  );

  const roadPaths = useMemo(
    () =>
      roadsFromConnections(connections).flatMap((road) => {
        const from = anchors.get(road.fromTerritoryId);
        const to = anchors.get(road.toTerritoryId);

        if (!from || !to) return [];

        return [{
          ...road,
          d: createRoadCurve(
            from,
            to,
            road.fromTerritoryId,
            road.toTerritoryId,
          ),
        }];
      }),
    [anchors, connections],
  );

  return (
    <svg
      aria-hidden="true"
      className="road-network absolute inset-0 h-full w-full overflow-visible"
      data-visible={visible ? "true" : "false"}
      viewBox="0 0 1254 1254"
    >
      {roadPaths.map((road) => {
        const connectedToSelection =
          selectedTerritoryId !== null &&
          (road.fromTerritoryId === selectedTerritoryId ||
            road.toTerritoryId === selectedTerritoryId);
        const reachesTarget =
          targetIds.has(road.fromTerritoryId) ||
          targetIds.has(road.toTerritoryId);

        return (
          <g
            key={road.id}
            className="road-route"
            data-active={connectedToSelection ? "true" : "false"}
            data-target={reachesTarget ? "true" : "false"}
          >
            <path d={road.d} className="road-route-shadow" />
            <path d={road.d} className="road-route-surface" />
            <path d={road.d} className="road-route-center" />
          </g>
        );
      })}
    </svg>
  );
}
