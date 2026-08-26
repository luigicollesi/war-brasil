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
    let timeoutId = 0;
    let inFlight: Promise<void> | null = null;

    function sync() {
      if (inFlight) return inFlight;

      const run = (async () => {
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
          if (requestController === controller) requestController = null;
        }
      })();

      inFlight = run.finally(() => {
        if (inFlight === run) inFlight = null;
      });

      return inFlight;
    }

    async function poll() {
      await sync();
      if (isActive) timeoutId = window.setTimeout(() => void poll(), POLLING_INTERVAL_MS);
    }

    refreshRef.current = sync;
    void poll();

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
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
