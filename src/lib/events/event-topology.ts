import type { TerritoryConnection } from "../territory-connections";
import {
  EventConfigurationError,
  territoryConnectionKey,
  territoryConnectionPairKey,
  type ResolvedEventEffect,
  type TerritoryConnectionPair,
} from "./event-types";

function cloneBaseConnections(
  baseConnections: readonly TerritoryConnection[],
) {
  return baseConnections.map((connection) => ({ ...connection }));
}

function indexConnections(connections: TerritoryConnection[]) {
  const byKey = new Map<string, TerritoryConnection>();
  for (const connection of connections) {
    if (!connection.exists) continue;
    const key = territoryConnectionKey(
      connection.territoryA,
      connection.territoryB,
    );
    if (byKey.has(key)) {
      throw new EventConfigurationError(
        `A topologia efetiva recebeu a conexão ${key} mais de uma vez.`,
      );
    }
    byKey.set(key, connection);
  }
  return byKey;
}

function requireConnection(
  byKey: ReadonlyMap<string, TerritoryConnection>,
  pair: TerritoryConnectionPair,
) {
  const key = territoryConnectionPairKey(pair);
  const connection = byKey.get(key);
  if (!connection) {
    throw new EventConfigurationError(
      `Efeito resolvido referencia uma fronteira inexistente: ${key}.`,
    );
  }
  return connection;
}

function openConnection(connection: TerritoryConnection) {
  connection.passable = true;
  connection.barrierName = null;
  connection.description = null;
}

function blockConnection(connection: TerritoryConnection) {
  connection.passable = false;
  connection.barrierName = null;
  connection.description = null;
}

export function applyEventConnectionEffects(
  baseConnections: readonly TerritoryConnection[],
  resolvedEffects: readonly ResolvedEventEffect[],
): TerritoryConnection[] {
  const connections = cloneBaseConnections(baseConnections);
  const byKey = indexConnections(connections);

  for (const effect of resolvedEffects) {
    switch (effect.type) {
      case "OPEN_CONNECTIONS":
      case "RANDOM_OPEN_CONNECTIONS":
        for (const pair of effect.connections) {
          openConnection(requireConnection(byKey, pair));
        }
        break;

      case "BLOCK_CONNECTIONS":
      case "RANDOM_BLOCK_CONNECTIONS":
        for (const pair of effect.connections) {
          blockConnection(requireConnection(byKey, pair));
        }
        break;

      case "RANDOM_TOGGLE_CONNECTIONS":
        for (const move of effect.moves) {
          const source = requireConnection(byKey, move.from);
          const target = requireConnection(byKey, move.to);
          openConnection(source);
          target.passable = false;
          target.barrierName = move.barrierName;
          target.description = move.description;
        }
        break;

      case "ADD_TROOPS":
      case "REMOVE_TROOPS":
      case "BLOCK_ATTACK":
        break;
    }
  }

  return connections;
}
