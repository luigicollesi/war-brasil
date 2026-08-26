"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSnapshot } from "@/src/lib/game";
import {
  GAME_REVISION_HEADER,
  parseGameRevision,
} from "@/src/lib/game-sync-contract";

const POLLING_INTERVAL_MS = 1_000;
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
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const revisionRef = useRef<number | null>(null);

  useEffect(() => {
    let isActive = true;
    let requestController: AbortController | null = null;
    let advanceController: AbortController | null = null;
    let timeoutId = 0;
    let inFlight: Promise<void> | null = null;

    function sync() {
      if (inFlight) return inFlight;

      const run = (async () => {
        const controller = new AbortController();
        requestController = controller;

        try {
          const headers = new Headers();
          if (revisionRef.current !== null) {
            headers.set(GAME_REVISION_HEADER, String(revisionRef.current));
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

          if (response.status === 204) {
            if (responseRevision !== null) {
              revisionRef.current = responseRevision;
            }
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
            return;
          }

          if (responseRevision !== null) {
            revisionRef.current = responseRevision;
          }

          if (isActive) {
            const nextSnapshot = data as GameSnapshot;
            snapshotRef.current = nextSnapshot;
            setSnapshot(nextSnapshot);
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

        return (
          changed ||
          (returnedRevision !== null && returnedRevision !== expectedRevision)
        );
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

    async function poll() {
      await sync();

      if (isActive && (await advancePresentation())) {
        await sync();
      }

      if (isActive) {
        timeoutId = window.setTimeout(() => void poll(), POLLING_INTERVAL_MS);
      }
    }

    refreshRef.current = async () => {
      const hadInFlightRequest = inFlight !== null;
      await sync();

      if (hadInFlightRequest && isActive) {
        await sync();
      }
    };

    void poll();

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      requestController?.abort();
      advanceController?.abort();
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
