"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApplicableGameCommandResult } from "@/src/lib/game-command-patch";
import { registerGameCommandPatchHandler } from "@/src/lib/game-command-patch-bus";
import type { GameSnapshot } from "@/src/lib/game-contract";
import type { GameRealtimeEvent } from "@/src/lib/game-realtime-contract";
import { GamePollScheduler } from "@/src/lib/client/sync/game-poll-scheduler";
import {
  GameSyncController,
  type GameSyncResult,
} from "@/src/lib/client/sync/game-sync-controller";
import { createGameRealtimeTransport } from "@/src/lib/client/transport/create-game-realtime-transport";
import { gameRealtimeMode } from "@/src/lib/client/transport/game-realtime-mode";
import { gameSyncMetricsStore } from "@/src/lib/game-sync-metrics-store";
import {
  GAME_REVISION_HEADER,
  parseGameRevision,
} from "@/src/lib/game-sync-contract";

function shouldAdvancePresentation(snapshot: GameSnapshot) {
  return snapshot.room.automaticAdvancePending;
}

function responseMessage(data: unknown, fallback: string) {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
      ? data.error
      : fallback
  );
}

function revisionEvent(
  event: GameRealtimeEvent,
): event is Extract<
  GameRealtimeEvent,
  { type: "game.invalidate" | "realtime.ready" }
> {
  return event.type === "game.invalidate" || event.type === "realtime.ready";
}

export function useGameSync(roomId: string) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const refreshRef = useRef<(minimumRevision?: number) => Promise<void>>(
    async () => {},
  );
  const applyCommandResultRef = useRef<
    (result: ApplicableGameCommandResult) => boolean
  >(() => false);

  useEffect(() => {
    let isActive = true;
    let requestController: AbortController | null = null;
    let advanceController: AbortController | null = null;
    let timeoutId = 0;
    let inFlight: Promise<void> | null = null;
    const realtimeMode = gameRealtimeMode();
    const syncController = new GameSyncController(roomId, {
      realtimeMode,
      realtimeTransport: createGameRealtimeTransport(realtimeMode),
    });
    const pollScheduler = new GamePollScheduler();
    let realtimeState = syncController.realtimeState();

    syncController.reset();
    pollScheduler.reset();

    function recordSyncSuccess(startedAt: number, result: GameSyncResult) {
      pollScheduler.recordSuccess();
      gameSyncMetricsStore.recordSuccess(performance.now() - startedAt, {
        unchanged: result.unchanged,
        responseBytes: result.responseBytes,
        revision: result.revision,
      });
    }

    function sync() {
      if (inFlight) return inFlight;

      const run = (async () => {
        const controller = new AbortController();
        requestController = controller;
        const startedAt = performance.now();

        try {
          const result = await syncController.sync(controller.signal);
          recordSyncSuccess(startedAt, result);

          if (isActive) {
            if (result.changed && result.snapshot) {
              setSnapshot(result.snapshot);
            }
            setError("");
          }
        } catch (requestError) {
          const aborted =
            requestError instanceof DOMException && requestError.name === "AbortError";

          if (!aborted) {
            pollScheduler.recordFailure();
            if (typeof navigator !== "undefined" && !navigator.onLine) {
              gameSyncMetricsStore.recordOffline();
            } else {
              gameSyncMetricsStore.recordFailure();
            }
          }

          if (isActive && !aborted) {
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

      const tracked = run.finally(() => {
        if (inFlight === tracked) inFlight = null;
      });

      inFlight = tracked;
      return tracked;
    }

    async function advancePresentation() {
      const currentSnapshot = syncController.currentSnapshot();
      const expectedRevision = syncController.currentRevision();

      if (
        !currentSnapshot ||
        expectedRevision === null ||
        !shouldAdvancePresentation(currentSnapshot)
      ) {
        return false;
      }

      const controller = new AbortController();
      advanceController = controller;

      try {
        const response = await fetch(
          `/api/games/${encodeURIComponent(roomId)}/advance`,
          {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expectedRevision }),
            signal: controller.signal,
          },
        );
        const data: unknown = await response.json();

        if (!response.ok) {
          throw new Error(
            responseMessage(
              data,
              "Não foi possível avançar automaticamente a partida.",
            ),
          );
        }

        const returnedRevision = parseGameRevision(
          response.headers.get(GAME_REVISION_HEADER),
        );
        const changed =
          typeof data === "object" &&
          data !== null &&
          "changed" in data &&
          data.changed === true;

        if (returnedRevision !== null && returnedRevision !== expectedRevision) {
          syncController.requireRevision(returnedRevision);
        }

        return changed || returnedRevision !== expectedRevision;
      } catch (advanceError) {
        if (
          isActive &&
          !(advanceError instanceof DOMException && advanceError.name === "AbortError")
        ) {
          setError(
            advanceError instanceof Error
              ? advanceError.message
              : "Não foi possível avançar automaticamente a partida.",
          );
        }
        return false;
      } finally {
        if (advanceController === controller) advanceController = null;
      }
    }

    async function syncUntilRequiredRevision() {
      await sync();

      if (isActive && syncController.needsRequiredRevision()) {
        await sync();
      }
    }

    function currentPollDelay() {
      const currentSnapshot = syncController.currentSnapshot();
      return pollScheduler.nextDelay({
        visible: document.visibilityState === "visible",
        online: navigator.onLine,
        presentationPending: Boolean(
          currentSnapshot && shouldAdvancePresentation(currentSnapshot),
        ),
        realtimeMode,
        realtimeState,
      });
    }

    function scheduleNextPoll() {
      if (!isActive) return;
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => void poll(), currentPollDelay());
    }

    async function poll() {
      await syncUntilRequiredRevision();

      if (isActive && (await advancePresentation())) {
        await syncUntilRequiredRevision();
      }

      scheduleNextPoll();
    }

    async function wakeForRealtime() {
      await syncUntilRequiredRevision();
      scheduleNextPoll();
    }

    refreshRef.current = async (minimumRevision?: number) => {
      if (
        minimumRevision !== undefined &&
        syncController.hasObservedRevision(minimumRevision)
      ) {
        return;
      }

      if (minimumRevision !== undefined) {
        syncController.requireRevision(minimumRevision);
      }
      await syncUntilRequiredRevision();
    };

    applyCommandResultRef.current = (result) => {
      if (!isActive) return false;

      const nextSnapshot = syncController.applyCommandResult(result);
      if (!nextSnapshot) return false;

      setSnapshot(nextSnapshot);
      setError("");
      return true;
    };

    const unregisterCommandPatchHandler = registerGameCommandPatchHandler(
      roomId,
      (result) => applyCommandResultRef.current(result),
    );

    const unsubscribeRealtimeState = syncController.subscribeRealtimeState((state) => {
      const previous = realtimeState;
      realtimeState = state;
      gameSyncMetricsStore.recordRealtimeState(state);

      if (!isActive || realtimeMode !== "hybrid" || previous === state) return;

      if (state === "connected") {
        scheduleNextPoll();
        return;
      }

      if (
        state === "reconnecting" ||
        state === "degraded" ||
        state === "closed"
      ) {
        void syncUntilRequiredRevision().finally(scheduleNextPoll);
      }
    });

    const handleOffline = () => gameSyncMetricsStore.recordOffline();
    const handleOnline = () => {
      gameSyncMetricsStore.recordOnline();
      pollScheduler.reset();
      void syncUntilRequiredRevision().finally(scheduleNextPoll);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncUntilRequiredRevision().finally(scheduleNextPoll);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void syncController.startRealtime((event) => {
      gameSyncMetricsStore.recordRealtimeEvent(
        event,
        syncController.currentRevision(),
      );
      if (event.type === "realtime.pong") {
        gameSyncMetricsStore.recordRealtimeClock(syncController.realtimeClock());
      }
      if (
        realtimeMode === "hybrid" &&
        revisionEvent(event) &&
        !syncController.hasObservedRevision(event.payload.revision)
      ) {
        void wakeForRealtime();
      }
    });
    void poll();

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      requestController?.abort();
      advanceController?.abort();
      unsubscribeRealtimeState();
      syncController.stopRealtime();
      unregisterCommandPatchHandler();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      refreshRef.current = async () => {};
      applyCommandResultRef.current = () => false;
    };
  }, [roomId]);

  return {
    snapshot,
    error,
    isLoading,
    refresh: useCallback(
      (minimumRevision?: number) => refreshRef.current(minimumRevision),
      [],
    ),
    applyCommandResult: useCallback(
      (result: ApplicableGameCommandResult) => applyCommandResultRef.current(result),
      [],
    ),
  };
}
