import { applyEventConnectionEffects } from "./events/event-topology";
import type { ResolvedEventEffect } from "./events/event-types";
import {
  effectiveTerritoryConnections,
  type TerritoryConnection,
} from "./territory-connections";

export function effectiveGameConnections(
  baseConnections: readonly TerritoryConnection[],
  resolvedEffects: readonly ResolvedEventEffect[],
  jurassicTunnelDestinationId: number | null,
): TerritoryConnection[] {
  const eventConnections = applyEventConnectionEffects(
    baseConnections,
    resolvedEffects,
  );
  return effectiveTerritoryConnections(
    eventConnections,
    jurassicTunnelDestinationId,
  );
}
