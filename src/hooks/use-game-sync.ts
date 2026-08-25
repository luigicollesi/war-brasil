"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSnapshot } from "@/src/lib/game";

const POLLING_INTERVAL_MS = 1_000;

export function useGameSync(roomId: string) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let isActive = true;
    let requestController: AbortController | null = null;

    async function sync() {
      requestController?.abort();
      const controller = new AbortController();
      requestController = controller;

      try {
        const response = await fetch(`/api/games/${encodeURIComponent(roomId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : "Não foi possível atualizar a partida.";
          throw new Error(message);
        }

        if (isActive) {
          setSnapshot(data as GameSnapshot);
          setError("");
        }
      } catch (requestError) {
        if (
          isActive &&
          !(requestError instanceof DOMException && requestError.name === "AbortError")
        ) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Não foi possível atualizar a partida.",
          );
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    refreshRef.current = sync;
    void sync();
    const intervalId = window.setInterval(() => void sync(), POLLING_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      requestController?.abort();
      refreshRef.current = async () => {};
    };
  }, [roomId]);

  return {
    snapshot,
    error,
    isLoading,
    refresh: useCallback(() => refreshRef.current(), []),
  };
}
