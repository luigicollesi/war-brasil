"use client";

import type { GameCommandPatch } from "@/src/lib/game-command-patch";
import {
  GAME_REVISION_HEADER,
  parseGameRevision,
} from "@/src/lib/game-sync-contract";

export type GameCommandClientResult<T> = {
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

export async function runGameCommand<T = unknown>(
  roomId: string,
  path: string,
  body?: unknown,
  fallback = "Não foi possível concluir a ação.",
): Promise<GameCommandClientResult<T>> {
  const response = await fetch(
    `/api/games/${encodeURIComponent(roomId)}/${path}`,
    {
      method: "POST",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );

  const data: unknown = await response.json();
  if (!response.ok) throw new Error(errorMessage(data, fallback));
  const envelope = commandEnvelope(data);

  return {
    data: data as T,
    baseRevision: envelope.baseRevision,
    revision: parseGameRevision(response.headers.get(GAME_REVISION_HEADER)),
    patch: envelope.patch,
  };
}
