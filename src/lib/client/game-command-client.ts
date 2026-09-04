"use client";

import type { GameCommandPatch } from "../shared/game-command-patch";
import {
  GAME_COMMAND_ID_HEADER,
  GAME_EXPECTED_REVISION_HEADER,
} from "../shared/game-command-request";
import { dispatchGameCommandPatch } from "./game-command-patch-bus";
import {
  currentGameCommandRevision,
  recoverGameCommandRevision,
} from "./game-command-sync-context";
import {
  GAME_REVISION_HEADER,
  parseGameRevision,
} from "../shared/game-sync-contract";

type GameCommandClientResult<T> = {
  data: T;
  baseRevision: number | null;
  revision: number | null;
  patch?: GameCommandPatch;
};

function errorMessage(data: unknown, fallback: string) {
  return typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
    ? data.error
    : fallback;
}

function commandEnvelope(data: unknown) {
  if (typeof data !== "object" || data === null) {
    return {
      baseRevision: null,
      patch: undefined,
    };
  }

  const record = data as Record<string, unknown>;
  const baseRevision =
    typeof record.baseRevision === "number" &&
    Number.isSafeInteger(record.baseRevision) &&
    record.baseRevision >= 1
      ? record.baseRevision
      : null;
  const patch =
    typeof record.patch === "object" && record.patch !== null
      ? (record.patch as GameCommandPatch)
      : undefined;

  return { baseRevision, patch };
}

async function responseData(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function retryableStatus(status: number) {
  return status === 502 || status === 503 || status === 504;
}

export async function runGameCommand<T = unknown>(
  roomId: string,
  path: string,
  body?: unknown,
  fallback = "Não foi possível concluir a ação.",
): Promise<GameCommandClientResult<T>> {
  const expectedRevision = currentGameCommandRevision(roomId);
  const commandId = expectedRevision === null ? null : crypto.randomUUID();
  const headers = new Headers();
  const serializedBody = body === undefined ? undefined : JSON.stringify(body);

  if (serializedBody !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (commandId !== null && expectedRevision !== null) {
    headers.set(GAME_COMMAND_ID_HEADER, commandId);
    headers.set(GAME_EXPECTED_REVISION_HEADER, String(expectedRevision));
  }

  const send = () =>
    fetch(`/api/games/${encodeURIComponent(roomId)}/${path}`, {
      method: "POST",
      cache: "no-store",
      headers,
      body: serializedBody,
    });

  let response: Response | null = null;
  let firstError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await send();
    } catch (error) {
      firstError ??= error;
      if (attempt === 0 && commandId !== null) continue;
      throw error;
    }

    if (
      attempt === 0 &&
      commandId !== null &&
      retryableStatus(response.status)
    ) {
      continue;
    }
    break;
  }

  if (!response) {
    throw firstError ?? new Error(fallback);
  }

  const data = await responseData(response);
  const returnedRevision = parseGameRevision(
    response.headers.get(GAME_REVISION_HEADER),
  );

  if (!response.ok) {
    if (
      returnedRevision !== null &&
      expectedRevision !== null &&
      returnedRevision !== expectedRevision
    ) {
      await recoverGameCommandRevision(roomId, returnedRevision).catch(
        () => undefined,
      );
    }
    throw new Error(errorMessage(data, fallback));
  }

  const envelope = commandEnvelope(data);
  const result: GameCommandClientResult<T> = {
    data: data as T,
    baseRevision: envelope.baseRevision,
    revision: returnedRevision,
    patch: envelope.patch,
  };

  if (result.patch) {
    dispatchGameCommandPatch(roomId, result);
  }

  return result;
}
