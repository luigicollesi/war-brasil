"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyGameCommandPatch,
  type ApplicableGameCommandResult,
} from "@/src/lib/game-command-patch";
import { registerGameCommandPatchHandler } from "@/src/lib/game-command-patch-bus";
import type { GameSnapshot } from "@/src/lib/game-contract";
import { nextGamePollDelay } from "@/src/lib/game-polling";
import { shareGameSnapshot } from "@/src/lib/game-snapshot-sharing";
import { gameSyncMetricsStore } from "@/src/lib/game-sync-metrics-store";
import {
  GAME_REVISION_HEADER,
  GAME_TOPOLOGY_HEADER,
  parseGameRevision,
} from "@/src/lib/game-sync-contract";

type GameSnapshotPayload = Omit<GameSnapshot, "connections"> & {
  connections?: GameSnapshot["connections"];
};

const ADVANCEABLE_BATTLE_STAGES = new Set([
  "show_attacker_result",
  "show_defender_result",
  "show_comparison",
  "show_battle_result",
]);

function shouldAdvancePresentation(snapshot: GameSnapshot) {
  if (
    snapshot.room.status === "order_roll" &&
    snapshot.room.orderRollPlayerId === null &&
    snapshot.eligiblePlayerIds.length > 0
  ) {
    return true;
  }

  const battle = snapshot.room.battle;
  return Boolean(battle && ADVANCEABLE_BATTLE_STAGES.has(battle.stage));
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
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const revisionRef = useRef<number | null>(null);
  const requiredRevisionRef = useRef<number | null>(null);
  const topologyVersionRef = useRef<string | null>(null);
  const topologyConnectionsRef = useRef<GameSnapshot["connections"] | null>(null);

  useEffect(() => {
    let isActive = true;
    let requestController: AbortController | null = null;
    let advanceController: AbortController | null = null;
    let timeoutId = 0;
    let inFlight: Promise<void> | null = null;
    let consecutiveFailures = 0;

    // Estado de sincronização é específico da sala; a topologia base não é.
    snapshotRef.current = null;
    revisionRef.current = null;
    requiredRevisionRef.current = null;

    function recordRevision(revision: number | null) {
      if (revision === null) return;
      if (revisionRef.current === null || revision >= revisionRef.current) {
        revisionRef.current = revision;
      }
      if (
        requiredRevisionRef.current !== null &&
        revision >= requiredRevisionRef.current
      ) {
        requiredRevisionRef.current = null;
      }
    }

    function recordSyncSuccess(startedAt: number) {
      consecutiveFailures = 0;
      gameSyncMetricsStore.recordSuccess(performance.now() - startedAt);
    }

    function sync() {
      if (inFlight) return inFlight;

      const run = (async () => {
        const controller = new AbortController();
        requestController = controller;
        const startedAt = performance.now();

        try {
          const headers = new Headers();
          if (revisionRef.current !== null) {
            headers.set(GAME_REVISION_HEADER, String(revisionRef.current));
          }
          if (
            topologyVersionRef.current !== null &&
            topologyConnectionsRef.current !== null
          ) {
            headers.set(GAME_TOPOLOGY_HEADER, topologyVersionRef.current);
          }

          const response = await fetch(
            `/api/games/${encodeURIComponent(roomId)}`,
            {
              cache: "no-store",
              headers,
              signal: controller.signal,
            },
          );
          const responseRevision = parseGameRevision(
            response.headers.get(GAME_REVISION_HEADER),
          );
          const responseTopologyVersion = response.headers.get(
            GAME_TOPOLOGY_HEADER,
          );

          if (response.status === 204) {
            recordRevision(responseRevision);
            recordSyncSuccess(startedAt);
            if (isActive) setError("");
            return;
          }

          const data: unknown = await response.json();
          if (!response.ok) {
            throw new Error(
              responseMessage(data, "Não foi possível atualizar a partida."),
            );
          }

          if (
            responseRevision !== null &&
            revisionRef.current !== null &&
            responseRevision < revisionRef.current
          ) {
            recordSyncSuccess(startedAt);
            return;
          }

          const payload = data as GameSnapshotPayload;
          const connections = payload.connections ?? topologyConnectionsRef.current;
          if (!connections) {
            throw new Error("A topologia da partida não foi recebida.");
          }

          if (payload.connections) {
            topologyConnectionsRef.current = payload.connections;
            if (responseTopologyVersion) {
              topologyVersionRef.current = responseTopologyVersion;
            }
          }

          const hydratedSnapshot: GameSnapshot = {
            ...payload,
            connections,
          };

          recordRevision(responseRevision);
          recordSyncSuccess(startedAt);

          if (isActive) {
            const nextSnapshot = shareGameSnapshot(
              snapshotRef.current,
              hydratedSnapshot,
            );
            snapshotRef.current = nextSnapshot;
            setSnapshot(nextSnapshot);
            setError("");
          }
        } catch (requestError) {
          const aborted =
            requestError instanceof DOMException && requestError.name === "AbortError";

          if (!aborted) {
            consecutiveFailures += 1;
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
      const currentSnapshot = snapshotRef.current;
      const expectedRevision = revisionRef.current;

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
              "Não foi possível avançar a apresentação da partida.",
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
          requiredRevisionRef.current = Math.max(
            requiredRevisionRef.current ?? 0,
            returnedRevision,
          );
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
              : "Não foi possível avançar a apresentação da partida.",
          );
        }
        return false;
      } finally {
        if (advanceController === controller) advanceController = null;
      }
    }

    async function syncUntilRequiredRevision() {
      await sync();

      if (
        isActive &&
        requiredRevisionRef.current !== null &&
        (revisionRef.current ?? 0) < requiredRevisionRef.current
      ) {
        await sync();
      }
    }

    function currentPollDelay() {
      const currentSnapshot = snapshotRef.current;
      return nextGamePollDelay({
        visible: document.visibilityState === "visible",
        online: navigator.onLine,
        failures: consecutiveFailures,
        presentationPending: Boolean(
          currentSnapshot && shouldAdvancePresentation(currentSnapshot),
        ),
      });
    }

    async function poll() {
      await syncUntilRequiredRevision();

      if (isActive && (await advancePresentation())) {
        await syncUntilRequiredRevision();
      }

      if (isActive) {
        timeoutId = window.setTimeout(() => void poll(), currentPollDelay());
      }
    }

    refreshRef.current = async (minimumRevision?: number) => {
      if (
        minimumRevision !== undefined &&
        revisionRef.current !== null &&
        revisionRef.current >= minimumRevision
      ) {
        return;
      }

      if (minimumRevision !== undefined) {
        requiredRevisionRef.current = Math.max(
          requiredRevisionRef.current ?? 0,
          minimumRevision,
        );
      }
      await syncUntilRequiredRevision();
    };

    applyCommandResultRef.current = (result) => {
      const currentSnapshot = snapshotRef.current;
      if (
        !isActive ||
        !currentSnapshot ||
        !result.patch ||
        result.baseRevision === null ||
        result.revision === null ||
        revisionRef.current !== result.baseRevision ||
        result.revision <= result.baseRevision
      ) {
        return false;
      }

      const nextSnapshot = applyGameCommandPatch(currentSnapshot, result.patch);
      if (!nextSnapshot) return false;

      recordRevision(result.revision);
      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
      setError("");
      return true;
    };

    const unregisterCommandPatchHandler = registerGameCommandPatchHandler(
      roomId,
      (result) => applyCommandResultRef.current(result),
    );

    const handleOffline = () => gameSyncMetricsStore.recordOffline();
    const handleOnline = () => {
      gameSyncMetricsStore.recordOnline();
      consecutiveFailures = 0;
      void syncUntilRequiredRevision();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncUntilRequiredRevision();
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void poll();

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      requestController?.abort();
      advanceController?.abort();
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
