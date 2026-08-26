"use client";

import {
  GAME_REVISION_HEADER,
  parseGameRevision,
} from "@/src/lib/game-sync-contract";

export type GameCommandClientResult<T> = {
  data: T;
  revision: number | null;
};

function errorMessage(data: unknown, fallback: string) {
  return typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
    ? data.error
    : fallback;
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

  return {
    data: data as T,
    revision: parseGameRevision(response.headers.get(GAME_REVISION_HEADER)),
  };
}
