"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LobbySnapshot } from "@/src/lib/lobby";
import { createLobbySyncCoordinator } from "@/src/lib/client/lobby-sync-coordinator";

const POLLING_INTERVAL_MS = 1_000;
const REQUEST_TIMEOUT_MS = 4_000;

export function useLobbySync(code: string) {
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let isActive = true;
    let requestController: AbortController | null = null;
    let pollTimeoutId = 0;

    const coordinator = createLobbySyncCoordinator(async () => {
      const controller = new AbortController();
      requestController = controller;
      let requestTimedOut = false;
      const requestTimeoutId = window.setTimeout(() => {
        requestTimedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

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

        if (isActive && (!aborted || requestTimedOut)) {
          setError(
            requestTimedOut
              ? "A sincronização demorou além do esperado. Tentando novamente."
              : requestError instanceof Error
                ? requestError.message
                : "Não foi possível atualizar a lobby.",
          );
        }
      } finally {
        window.clearTimeout(requestTimeoutId);
        if (isActive) setIsLoading(false);
        if (requestController === controller) requestController = null;
      }
    });

    async function poll() {
      await coordinator.sync();
      if (isActive) {
        pollTimeoutId = window.setTimeout(() => void poll(), POLLING_INTERVAL_MS);
      }
    }

    // Refresh disparado por uma mutação precisa observar um GET iniciado depois
    // da mutação. Reaproveitar um polling já em voo pode devolver um snapshot
    // anterior ao commit e atrasar a convergência visual da sala.
    refreshRef.current = coordinator.refreshAfterCurrent;
    void poll();

    return () => {
      isActive = false;
      window.clearTimeout(pollTimeoutId);
      requestController?.abort();
      refreshRef.current = async () => {};
    };
  }, [code]);

  const refresh = useCallback(() => refreshRef.current(), []);

  return { snapshot, error, isLoading, refresh };
}
