import type { TerritoryConnection } from "../territory-connections";
import {
  EventConfigurationError,
  canonicalTerritoryConnectionPair,
  territoryConnectionKey,
  territoryConnectionPairKey,
  type EventEffect,
  type ResolvedBarrierMove,
  type ResolvedEventEffect,
  type TerritoryConnectionPair,
} from "./event-types";

export type RandomIndex = (exclusiveMax: number) => number;

export type ResolveEventEffectsInput = {
  effects: readonly EventEffect[];
  baseConnections: readonly TerritoryConnection[];
  randomIndex: RandomIndex;
  protectedConnections?: readonly TerritoryConnectionPair[];
};

function connectionKey(connection: TerritoryConnection) {
  return territoryConnectionKey(connection.territoryA, connection.territoryB);
}

function sortedConnections(connections: readonly TerritoryConnection[]) {
  return [...connections].sort((left, right) =>
    connectionKey(left).localeCompare(connectionKey(right), undefined, {
      numeric: true,
    }),
  );
}

function baseConnectionMap(baseConnections: readonly TerritoryConnection[]) {
  const map = new Map<string, TerritoryConnection>();

  for (const connection of baseConnections) {
    if (!connection.exists) continue;
    const key = connectionKey(connection);
    if (map.has(key)) {
      throw new EventConfigurationError(
        `A topologia base possui a conexão ${key} mais de uma vez.`,
      );
    }
    map.set(key, connection);
  }

  return map;
}

function resolveRandomIndex(randomIndex: RandomIndex, exclusiveMax: number) {
  if (!Number.isInteger(exclusiveMax) || exclusiveMax <= 0) {
    throw new EventConfigurationError("Não existem candidatos para o sorteio.");
  }

  const index = randomIndex(exclusiveMax);
  if (!Number.isInteger(index) || index < 0 || index >= exclusiveMax) {
    throw new EventConfigurationError(
      `Índice aleatório inválido para ${exclusiveMax} candidatos.`,
    );
  }
  return index;
}

function pickWithoutReplacement<T>(
  candidates: readonly T[],
  count: number,
  randomIndex: RandomIndex,
  insufficientMessage: string,
) {
  if (candidates.length < count) {
    throw new EventConfigurationError(insufficientMessage);
  }

  const pool = [...candidates];
  const picked: T[] = [];
  for (let index = 0; index < count; index += 1) {
    const selectedIndex = resolveRandomIndex(randomIndex, pool.length);
    picked.push(pool.splice(selectedIndex, 1)[0]);
  }
  return picked;
}

function connectionPair(connection: TerritoryConnection): TerritoryConnectionPair {
  return canonicalTerritoryConnectionPair(
    connection.territoryA,
    connection.territoryB,
  );
}

function assertFixedConnectionEffect(
  effect: Extract<EventEffect, { type: "OPEN_CONNECTIONS" | "BLOCK_CONNECTIONS" }>,
  baseByKey: ReadonlyMap<string, TerritoryConnection>,
  claimed: Set<string>,
) {
  const expectPassable = effect.type === "BLOCK_CONNECTIONS";

  for (const pair of effect.connections) {
    const key = territoryConnectionPairKey(pair);
    const base = baseByKey.get(key);
    if (!base || base.passable !== expectPassable) {
      throw new EventConfigurationError(
        effect.type === "OPEN_CONNECTIONS"
          ? `OPEN_CONNECTIONS só pode abrir uma fronteira base bloqueada: ${key}.`
          : `BLOCK_CONNECTIONS só pode bloquear uma fronteira base aberta: ${key}.`,
      );
    }
    if (claimed.has(key)) {
      throw new EventConfigurationError(
        `A conexão ${key} recebe mais de uma alteração no mesmo evento.`,
      );
    }
    claimed.add(key);
  }
}

function randomConnectionCandidates(
  baseConnections: readonly TerritoryConnection[],
  passable: boolean,
  claimed: ReadonlySet<string>,
  protectedKeys: ReadonlySet<string>,
) {
  return sortedConnections(
    baseConnections.filter((connection) => {
      const key = connectionKey(connection);
      return (
        connection.exists &&
        connection.passable === passable &&
        !claimed.has(key) &&
        !protectedKeys.has(key)
      );
    }),
  );
}

function touching(connection: TerritoryConnection, territoryId: number) {
  return (
    connection.territoryA === territoryId || connection.territoryB === territoryId
  );
}

function resolveBarrierMoves(
  count: number,
  baseConnections: readonly TerritoryConnection[],
  claimed: Set<string>,
  protectedKeys: ReadonlySet<string>,
  randomIndex: RandomIndex,
): ResolvedBarrierMove[] {
  const moves: ResolvedBarrierMove[] = [];

  for (let moveIndex = 0; moveIndex < count; moveIndex += 1) {
    const blocked = randomConnectionCandidates(
      baseConnections,
      false,
      claimed,
      protectedKeys,
    );
    const open = randomConnectionCandidates(
      baseConnections,
      true,
      claimed,
      protectedKeys,
    );

    const anchors = Array.from(
      new Set(blocked.flatMap((connection) => [connection.territoryA, connection.territoryB])),
    )
      .filter(
        (territoryId) =>
          blocked.some((connection) => touching(connection, territoryId)) &&
          open.some((connection) => touching(connection, territoryId)),
      )
      .sort((left, right) => left - right);

    if (anchors.length === 0) {
      throw new EventConfigurationError(
        `RANDOM_TOGGLE_CONNECTIONS não possui candidatos suficientes para ${count} movimento(s).`,
      );
    }

    const anchorTerritoryId =
      anchors[resolveRandomIndex(randomIndex, anchors.length)];
    const sourceCandidates = blocked.filter((connection) =>
      touching(connection, anchorTerritoryId),
    );
    const targetCandidates = open.filter((connection) =>
      touching(connection, anchorTerritoryId),
    );
    const source =
      sourceCandidates[resolveRandomIndex(randomIndex, sourceCandidates.length)];
    const target =
      targetCandidates[resolveRandomIndex(randomIndex, targetCandidates.length)];

    const from = connectionPair(source);
    const to = connectionPair(target);
    claimed.add(territoryConnectionPairKey(from));
    claimed.add(territoryConnectionPairKey(to));

    moves.push({
      anchorTerritoryId,
      from,
      to,
      barrierName: source.barrierName,
      description: source.description,
    });
  }

  return moves;
}

export function resolveEventEffects({
  effects,
  baseConnections,
  randomIndex,
  protectedConnections = [],
}: ResolveEventEffectsInput): ResolvedEventEffect[] {
  const baseByKey = baseConnectionMap(baseConnections);
  const claimed = new Set<string>();
  const protectedKeys = new Set(protectedConnections.map(territoryConnectionPairKey));
  const resolved: ResolvedEventEffect[] = [];

  for (const effect of effects) {
    switch (effect.type) {
      case "ADD_TROOPS":
      case "REMOVE_TROOPS":
        resolved.push({
          type: effect.type,
          territories: [...effect.territories],
          amount: effect.amount,
        });
        break;

      case "BLOCK_ATTACK":
        resolved.push({
          type: effect.type,
          territories: [...effect.territories],
        });
        break;

      case "OPEN_CONNECTIONS":
      case "BLOCK_CONNECTIONS":
        assertFixedConnectionEffect(effect, baseByKey, claimed);
        resolved.push({
          type: effect.type,
          connections: effect.connections.map(([a, b]) =>
            canonicalTerritoryConnectionPair(a, b),
          ),
        });
        break;

      case "RANDOM_OPEN_CONNECTIONS": {
        const candidates = randomConnectionCandidates(
          baseConnections,
          false,
          claimed,
          protectedKeys,
        );
        const picked = pickWithoutReplacement(
          candidates,
          effect.count,
          randomIndex,
          `RANDOM_OPEN_CONNECTIONS não possui ${effect.count} fronteira(s) bloqueada(s) elegível(is).`,
        );
        const connections = picked.map(connectionPair);
        connections.forEach((pair) => claimed.add(territoryConnectionPairKey(pair)));
        resolved.push({ type: effect.type, connections });
        break;
      }

      case "RANDOM_BLOCK_CONNECTIONS": {
        const candidates = randomConnectionCandidates(
          baseConnections,
          true,
          claimed,
          protectedKeys,
        );
        const picked = pickWithoutReplacement(
          candidates,
          effect.count,
          randomIndex,
          `RANDOM_BLOCK_CONNECTIONS não possui ${effect.count} fronteira(s) aberta(s) elegível(is).`,
        );
        const connections = picked.map(connectionPair);
        connections.forEach((pair) => claimed.add(territoryConnectionPairKey(pair)));
        resolved.push({ type: effect.type, connections });
        break;
      }

      case "RANDOM_TOGGLE_CONNECTIONS":
        resolved.push({
          type: effect.type,
          moves: resolveBarrierMoves(
            effect.count,
            baseConnections,
            claimed,
            protectedKeys,
            randomIndex,
          ),
        });
        break;
    }
  }

  return resolved;
}
