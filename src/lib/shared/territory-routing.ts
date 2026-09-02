import type { TerritoryConnection } from "./territory-connections";

export type TerritoryRoute =
  | {
      kind: "reachable";
      territoryId: number;
      path: readonly number[];
      steps: number;
      barrierCount: number;
      barriers: readonly TerritoryConnection[];
    }
  | {
      kind: "unreachable";
      territoryId: number;
    };

type RouteEdge = {
  to: number;
  connection: TerritoryConnection;
};

type PreviousStep = {
  territoryId: number;
  connection: TerritoryConnection;
};

function sortedAllowedTerritoryIds(territoryIds: Iterable<number>) {
  return Array.from(new Set(territoryIds))
    .filter((territoryId) => Number.isInteger(territoryId))
    .sort((a, b) => a - b);
}

function buildAdjacency(
  connections: readonly TerritoryConnection[],
  allowed: ReadonlySet<number>,
) {
  const adjacency = new Map<number, RouteEdge[]>();

  for (const territoryId of allowed) {
    adjacency.set(territoryId, []);
  }

  for (const connection of connections) {
    if (
      !connection.exists ||
      connection.territoryA === connection.territoryB ||
      !allowed.has(connection.territoryA) ||
      !allowed.has(connection.territoryB)
    ) {
      continue;
    }

    adjacency.get(connection.territoryA)?.push({
      to: connection.territoryB,
      connection,
    });
    adjacency.get(connection.territoryB)?.push({
      to: connection.territoryA,
      connection,
    });
  }

  for (const edges of adjacency.values()) {
    edges.sort((a, b) => {
      if (a.to !== b.to) return a.to - b.to;
      if (a.connection.passable !== b.connection.passable) {
        return a.connection.passable ? -1 : 1;
      }
      return (a.connection.barrierName ?? "").localeCompare(
        b.connection.barrierName ?? "",
      );
    });
  }

  return adjacency;
}

function unreachableRoute(territoryId: number): TerritoryRoute {
  return { kind: "unreachable", territoryId };
}

function reconstructRoute(
  startTerritoryId: number,
  targetTerritoryId: number,
  previous: ReadonlyMap<number, PreviousStep>,
  allowedCount: number,
): TerritoryRoute {
  if (targetTerritoryId === startTerritoryId) {
    return {
      kind: "reachable",
      territoryId: targetTerritoryId,
      path: [startTerritoryId],
      steps: 0,
      barrierCount: 0,
      barriers: [],
    };
  }

  const reversedPath = [targetTerritoryId];
  const reversedBarriers: TerritoryConnection[] = [];
  let current = targetTerritoryId;

  while (current !== startTerritoryId) {
    const step = previous.get(current);
    if (!step) return unreachableRoute(targetTerritoryId);

    if (!step.connection.passable) {
      reversedBarriers.push(step.connection);
    }

    current = step.territoryId;
    reversedPath.push(current);

    // Uma rota ótima com pesos positivos nunca precisa repetir um vértice.
    if (reversedPath.length > allowedCount + 1) {
      return unreachableRoute(targetTerritoryId);
    }
  }

  const path = reversedPath.reverse();
  const barriers = reversedBarriers.reverse();

  return {
    kind: "reachable",
    territoryId: targetTerritoryId,
    path,
    steps: path.length - 1,
    barrierCount: barriers.length,
    barriers,
  };
}

/**
 * Calcula as melhores rotas usando custo lexicográfico equivalente:
 * primeiro minimiza o número de barreiras e, em empate, o número de passos.
 *
 * Para V territórios permitidos, cada passo custa 1 e cada barreira adiciona V.
 * Como uma rota simples possui no máximo V - 1 passos, uma barreira adicional
 * sempre custa mais que qualquer economia possível em distância.
 */
export function bestTerritoryRoutes(
  connections: readonly TerritoryConnection[],
  startTerritoryId: number,
  allowedTerritoryIds: Iterable<number>,
): ReadonlyMap<number, TerritoryRoute> {
  const allowedIds = sortedAllowedTerritoryIds(allowedTerritoryIds);
  const allowed = new Set(allowedIds);
  const routes = new Map<number, TerritoryRoute>();

  if (!allowed.has(startTerritoryId)) {
    for (const territoryId of allowedIds) {
      routes.set(territoryId, unreachableRoute(territoryId));
    }
    return routes;
  }

  const adjacency = buildAdjacency(connections, allowed);
  const barrierWeight = Math.max(1, allowedIds.length);
  const distance = new Map<number, number>();
  const previous = new Map<number, PreviousStep>();
  const unvisited = new Set(allowedIds);

  for (const territoryId of allowedIds) {
    distance.set(territoryId, Number.POSITIVE_INFINITY);
  }
  distance.set(startTerritoryId, 0);

  while (unvisited.size > 0) {
    let current: number | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    // Empates são resolvidos pelo menor territoryId para manter determinismo.
    for (const territoryId of unvisited) {
      const candidateDistance = distance.get(territoryId) ?? Number.POSITIVE_INFINITY;
      if (
        candidateDistance < currentDistance ||
        (candidateDistance === currentDistance &&
          current !== null &&
          territoryId < current)
      ) {
        current = territoryId;
        currentDistance = candidateDistance;
      }
    }

    if (current === null || !Number.isFinite(currentDistance)) break;
    unvisited.delete(current);

    for (const edge of adjacency.get(current) ?? []) {
      if (!unvisited.has(edge.to)) continue;

      const edgeWeight = 1 + (edge.connection.passable ? 0 : barrierWeight);
      const candidateDistance = currentDistance + edgeWeight;
      const knownDistance = distance.get(edge.to) ?? Number.POSITIVE_INFINITY;

      if (candidateDistance < knownDistance) {
        distance.set(edge.to, candidateDistance);
        previous.set(edge.to, {
          territoryId: current,
          connection: edge.connection,
        });
      }
    }
  }

  for (const territoryId of allowedIds) {
    const territoryDistance = distance.get(territoryId) ?? Number.POSITIVE_INFINITY;
    routes.set(
      territoryId,
      Number.isFinite(territoryDistance)
        ? reconstructRoute(
            startTerritoryId,
            territoryId,
            previous,
            allowedIds.length,
          )
        : unreachableRoute(territoryId),
    );
  }

  return routes;
}

export function bestTerritoryRoute(
  connections: readonly TerritoryConnection[],
  startTerritoryId: number,
  targetTerritoryId: number,
  allowedTerritoryIds: Iterable<number>,
): TerritoryRoute {
  return (
    bestTerritoryRoutes(
      connections,
      startTerritoryId,
      allowedTerritoryIds,
    ).get(targetTerritoryId) ?? unreachableRoute(targetTerritoryId)
  );
}
