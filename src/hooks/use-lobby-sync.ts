"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LobbySnapshot } from "@/src/lib/lobby";
import { createLobbySyncCoordinator } from "@/src/lib/client/lobby-sync-coordinator";
import { createGameRealtimeTransport } from "@/src/lib/client/transport/create-game-realtime-transport";
import { gameRealtimeMode } from "@/src/lib/client/transport/game-realtime-mode";
import {
  GAME_REVISION_HEADER,
  parseGameRevision,
} from "@/src/lib/game-sync-contract";

const FALLBACK_POLLING_INTERVAL_MS = 2_000;
const REALTIME_WATCHDOG_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 4_000;
const TERMINAL_SYNC_STATUSES = new Set([401, 403, 404]);

export function useLobbySync(code: string) {
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let isActive = true;
    let requestController: AbortController | null = null;
    let pollTimeoutId = 0;
    let pollingStopped = false;
    let activeRoomId: string | null = null;
    let latestRevision = 0;

    const realtimeMode = gameRealtimeMode();
    const realtimeTransport = createGameRealtimeTransport(realtimeMode);
    let realtimeState = realtimeTransport.state();

    function nextPollDelay() {
      return realtimeMode === "hybrid" && realtimeState === "connected"
        ? REALTIME_WATCHDOG_INTERVAL_MS
        : FALLBACK_POLLING_INTERVAL_MS;
    }

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
        const revision = parseGameRevision(
          response.headers.get(GAME_REVISION_HEADER),
        );
        const data: unknown = await response.json();

        if (!response.ok) {
          if (TERMINAL_SYNC_STATUSES.has(response.status)) pollingStopped = true;
          const message =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : "Não foi possível atualizar a lobby.";
          throw new Error(message);
        }

        pollingStopped = false;
        const nextSnapshot = data as LobbySnapshot;
        activeRoomId = nextSnapshot.room.id;
        if (revision !== null) latestRevision = Math.max(latestRevision, revision);

        if (realtimeMode !== "off") {
          void realtimeTransport.connect({
            roomId: nextSnapshot.room.id,
            revision,
          });
        }

        if (isActive) {
          setSnapshot(nextSnapshot);
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
      if (isActive && !pollingStopped) {
        pollTimeoutId = window.setTimeout(() => void poll(), nextPollDelay());
      }
    }

    const unsubscribeRealtime = realtimeTransport.subscribe((event) => {
      if (
        !isActive ||
        realtimeMode !== "hybrid" ||
        !activeRoomId ||
        event.roomId !== activeRoomId
      ) {
        return;
      }
      if (event.type !== "game.invalidate" && event.type !== "realtime.ready") {
        return;
      }
      if (event.payload.revision <= latestRevision) return;
      void coordinator.refreshAfterCurrent();
    });

    const unsubscribeRealtimeState = realtimeTransport.subscribeState((state) => {
      const previous = realtimeState;
      realtimeState = state;
      if (!isActive || realtimeMode !== "hybrid" || previous === state) return;

      if (
        state === "connected" ||
        state === "reconnecting" ||
        state === "degraded" ||
        state === "closed"
      ) {
        window.clearTimeout(pollTimeoutId);
        pollTimeoutId = window.setTimeout(
          () => void poll(),
          state === "connected" ? REALTIME_WATCHDOG_INTERVAL_MS : 0,
        );
      }
    });

    refreshRef.current = coordinator.refreshAfterCurrent;
    void poll();

    return () => {
      isActive = false;
      window.clearTimeout(pollTimeoutId);
      requestController?.abort();
      unsubscribeRealtime();
      unsubscribeRealtimeState();
      realtimeTransport.disconnect();
      refreshRef.current = async () => {};
    };
  }, [code]);

  const refresh = useCallback(() => refreshRef.current(), []);

  return { snapshot, error, isLoading, refresh };
}
