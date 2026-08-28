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
  resolvedEffects: unknown[];
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
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function territoryId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 42
  );
}

function parseTerritories(value: unknown, effectType: string): number[] {
  if (!Array.isArray(value) || !value.every(territoryId)) {
    throw new EventConfigurationError(
      `${effectType} possui uma lista de territórios inválida.`,
    );
  }
  return [...value];
}

function parseConnections(
  value: unknown,
  effectType: string,
): TerritoryConnectionPair[] {
  if (!Array.isArray(value)) {
    throw new EventConfigurationError(
      `${effectType} possui uma lista de conexões inválida.`,
    );
  }

  return value.map((pair) => {
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      !territoryId(pair[0]) ||
      !territoryId(pair[1]) ||
      pair[0] === pair[1]
    ) {
      throw new EventConfigurationError(
        `${effectType} possui uma conexão territorial inválida.`,
      );
    }
    return [pair[0], pair[1]];
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

export function parseEventEffects(value: unknown): EventEffect[] {
  if (!Array.isArray(value)) {
    throw new EventConfigurationError("effects precisa ser um array JSON.");
  }
  return value.map(parseEffect);
}
