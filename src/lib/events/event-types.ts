export type TerritoryConnectionPair = [number, number];

export type EventEffect =
  | {
      type: "ADD_TROOPS";
      territories: number[];
      amount: number;
    }
  | {
      type: "REMOVE_TROOPS";
      territories: number[];
      amount: number;
    }
  | {
      type: "BLOCK_ATTACK";
      territories: number[];
    }
  | {
      type: "OPEN_CONNECTIONS";
      connections: TerritoryConnectionPair[];
    }
  | {
      type: "BLOCK_CONNECTIONS";
      connections: TerritoryConnectionPair[];
    }
  | {
      type: "RANDOM_OPEN_CONNECTIONS";
      count: number;
    }
  | {
      type: "RANDOM_BLOCK_CONNECTIONS";
      count: number;
    }
  | {
      type: "RANDOM_TOGGLE_CONNECTIONS";
      count: number;
    };

export type ResolvedBarrierMove = {
  anchorTerritoryId: number;
  from: TerritoryConnectionPair;
  to: TerritoryConnectionPair;
  barrierName: string | null;
  description: string | null;
};

export type ResolvedEventEffect =
  | Extract<
      EventEffect,
      { type: "ADD_TROOPS" | "REMOVE_TROOPS" | "BLOCK_ATTACK" | "OPEN_CONNECTIONS" | "BLOCK_CONNECTIONS" }
    >
  | {
      type: "RANDOM_OPEN_CONNECTIONS";
      connections: TerritoryConnectionPair[];
    }
  | {
      type: "RANDOM_BLOCK_CONNECTIONS";
      connections: TerritoryConnectionPair[];
    }
  | {
      type: "RANDOM_TOGGLE_CONNECTIONS";
      moves: ResolvedBarrierMove[];
    };

export type GameEvent = {
  id: number;
  name: string;
  description: string;
  effects: EventEffect[];
};

export type EventConnection = {
  fromEvent: number;
  toEvent: number;
  weight: number;
};

export type GameRoundEvent = {
  roomId: string;
  roundNumber: number;
  eventId: number;
  resolvedEffects: ResolvedEventEffect[];
  activatedAt: Date;
};

export class EventConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventConfigurationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function territoryId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 42
  );
}

export function territoryConnectionKey(territoryA: number, territoryB: number) {
  return territoryA < territoryB
    ? `${territoryA}:${territoryB}`
    : `${territoryB}:${territoryA}`;
}

export function territoryConnectionPairKey(pair: TerritoryConnectionPair) {
  return territoryConnectionKey(pair[0], pair[1]);
}

export function canonicalTerritoryConnectionPair(
  territoryA: number,
  territoryB: number,
): TerritoryConnectionPair {
  return territoryA < territoryB
    ? [territoryA, territoryB]
    : [territoryB, territoryA];
}

function parseTerritories(value: unknown, effectType: string): number[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(territoryId)) {
    throw new EventConfigurationError(
      `${effectType} possui uma lista de territórios inválida.`,
    );
  }

  if (new Set(value).size !== value.length) {
    throw new EventConfigurationError(
      `${effectType} possui territórios repetidos.`,
    );
  }

  return [...value];
}

function parseConnectionPair(
  value: unknown,
  effectType: string,
): TerritoryConnectionPair {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !territoryId(value[0]) ||
    !territoryId(value[1]) ||
    value[0] === value[1]
  ) {
    throw new EventConfigurationError(
      `${effectType} possui uma conexão territorial inválida.`,
    );
  }

  return canonicalTerritoryConnectionPair(value[0], value[1]);
}

function parseConnections(
  value: unknown,
  effectType: string,
): TerritoryConnectionPair[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new EventConfigurationError(
      `${effectType} possui uma lista de conexões inválida.`,
    );
  }

  const seen = new Set<string>();
  return value.map((pair) => {
    const parsed = parseConnectionPair(pair, effectType);
    const key = territoryConnectionPairKey(parsed);
    if (seen.has(key)) {
      throw new EventConfigurationError(
        `${effectType} possui conexões territoriais repetidas.`,
      );
    }
    seen.add(key);
    return parsed;
  });
}

function parseEffect(value: unknown): EventEffect {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new EventConfigurationError("Efeito de evento inválido.");
  }

  switch (value.type) {
    case "ADD_TROOPS":
    case "REMOVE_TROOPS":
      if (!positiveInteger(value.amount)) {
        throw new EventConfigurationError(
          `${value.type} precisa de uma quantidade positiva de tropas.`,
        );
      }
      return {
        type: value.type,
        territories: parseTerritories(value.territories, value.type),
        amount: value.amount,
      };

    case "BLOCK_ATTACK":
      return {
        type: value.type,
        territories: parseTerritories(value.territories, value.type),
      };

    case "OPEN_CONNECTIONS":
    case "BLOCK_CONNECTIONS":
      return {
        type: value.type,
        connections: parseConnections(value.connections, value.type),
      };

    case "RANDOM_OPEN_CONNECTIONS":
    case "RANDOM_BLOCK_CONNECTIONS":
    case "RANDOM_TOGGLE_CONNECTIONS":
      if (!positiveInteger(value.count)) {
        throw new EventConfigurationError(
          `${value.type} precisa de uma quantidade positiva.`,
        );
      }
      return {
        type: value.type,
        count: value.count,
      };

    default:
      throw new EventConfigurationError(
        `Tipo de efeito desconhecido: ${value.type}.`,
      );
  }
}

function nullableString(value: unknown, fieldName: string) {
  if (value === null) return null;
  if (typeof value === "string") return value;
  throw new EventConfigurationError(`${fieldName} precisa ser texto ou null.`);
}

function parseResolvedBarrierMoves(value: unknown): ResolvedBarrierMove[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new EventConfigurationError(
      "RANDOM_TOGGLE_CONNECTIONS precisa possuir movimentos resolvidos.",
    );
  }

  const claimed = new Set<string>();
  return value.map((move) => {
    if (!isRecord(move) || !territoryId(move.anchorTerritoryId)) {
      throw new EventConfigurationError("Movimento de barreira resolvido inválido.");
    }

    const from = parseConnectionPair(move.from, "RANDOM_TOGGLE_CONNECTIONS");
    const to = parseConnectionPair(move.to, "RANDOM_TOGGLE_CONNECTIONS");
    const fromKey = territoryConnectionPairKey(from);
    const toKey = territoryConnectionPairKey(to);

    if (fromKey === toKey) {
      throw new EventConfigurationError(
        "A barreira precisa ser movida para outra conexão.",
      );
    }
    if (!from.includes(move.anchorTerritoryId) || !to.includes(move.anchorTerritoryId)) {
      throw new EventConfigurationError(
        "Origem e destino da barreira precisam compartilhar o território âncora.",
      );
    }
    if (claimed.has(fromKey) || claimed.has(toKey)) {
      throw new EventConfigurationError(
        "Uma conexão não pode participar de dois movimentos de barreira.",
      );
    }
    claimed.add(fromKey);
    claimed.add(toKey);

    return {
      anchorTerritoryId: move.anchorTerritoryId,
      from,
      to,
      barrierName: nullableString(move.barrierName, "barrierName"),
      description: nullableString(move.description, "description"),
    };
  });
}

function parseResolvedEffect(value: unknown): ResolvedEventEffect {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new EventConfigurationError("Efeito resolvido inválido.");
  }

  switch (value.type) {
    case "ADD_TROOPS":
    case "REMOVE_TROOPS":
      if (!positiveInteger(value.amount)) {
        throw new EventConfigurationError(
          `${value.type} precisa de uma quantidade positiva de tropas.`,
        );
      }
      return {
        type: value.type,
        territories: parseTerritories(value.territories, value.type),
        amount: value.amount,
      };

    case "BLOCK_ATTACK":
      return {
        type: value.type,
        territories: parseTerritories(value.territories, value.type),
      };

    case "OPEN_CONNECTIONS":
    case "BLOCK_CONNECTIONS":
    case "RANDOM_OPEN_CONNECTIONS":
    case "RANDOM_BLOCK_CONNECTIONS":
      return {
        type: value.type,
        connections: parseConnections(value.connections, value.type),
      };

    case "RANDOM_TOGGLE_CONNECTIONS":
      return {
        type: value.type,
        moves: parseResolvedBarrierMoves(value.moves),
      };

    default:
      throw new EventConfigurationError(
        `Tipo de efeito resolvido desconhecido: ${value.type}.`,
      );
  }
}

export function parseEventEffects(value: unknown): EventEffect[] {
  if (!Array.isArray(value)) {
    throw new EventConfigurationError("effects precisa ser um array JSON.");
  }
  return value.map(parseEffect);
}

export function parseResolvedEventEffects(value: unknown): ResolvedEventEffect[] {
  if (!Array.isArray(value)) {
    throw new EventConfigurationError(
      "resolved_effects precisa ser um array JSON.",
    );
  }
  return value.map(parseResolvedEffect);
}
