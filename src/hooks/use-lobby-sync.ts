"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LobbySnapshot } from "@/src/lib/lobby";

const POLLING_INTERVAL_MS = 1_000;

export function useLobbySync(code: string) {
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
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
          const response = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
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
                : "Não foi possível atualizar a lobby.";
            throw new Error(message);
          }

          if (isActive) {
            setSnapshot(data as LobbySnapshot);
            setError("");
          }
        } catch (requestError) {
          const aborted =
            requestError instanceof DOMException && requestError.name === "AbortError";

          if (isActive && !aborted) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Não foi possível atualizar a lobby.",
            );
          }
        } finally {
          if (isActive) setIsLoading(false);
          if (requestController === controller) requestController = null;
        }
      })();

      const tracked = run.finally(() => {
        if (inFlight === tracked) inFlight = null;
      });
      inFlight = tracked;
      return tracked;
    }

    async function poll() {
      await sync();
      if (isActive) {
        timeoutId = window.setTimeout(() => void poll(), POLLING_INTERVAL_MS);
      }
    }

    refreshRef.current = sync;
    void poll();

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      requestController?.abort();
      refreshRef.current = async () => {};
    };
  }, [code]);

  const refresh = useCallback(() => refreshRef.current(), []);

  return { snapshot, error, isLoading, refresh };
}
