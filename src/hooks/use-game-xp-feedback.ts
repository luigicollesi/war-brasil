"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeBattlePassXpEvents } from "@/src/lib/client/game-realtime-ephemeral-bus";
import type { BattlePassGameXpEvent } from "@/src/lib/shared/progression/battle-pass-game-xp-event";

const NORMAL_DURATION_MS = {
  micro: 1_800,
  standard: 2_600,
  major: 3_600,
  terminal: 4_800,
} as const;

function liveMessage(event: BattlePassGameXpEvent) {
  const amount =
    event.kind === "match_settled"
      ? `${event.xp} experiência de campanha salva`
      : `mais ${event.xp} experiência de campanha`;
  return [event.label, amount, event.detail]
    .filter(Boolean)
    .join(". ");
}

export function useGameXpFeedback(
  roomId: string,
  options: Readonly<{ suspended: boolean }>,
) {
  const [activeEvent, setActiveEvent] =
    useState<BattlePassGameXpEvent | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const queueRef = useRef<BattlePassGameXpEvent[]>([]);
  const activeRef = useRef<BattlePassGameXpEvent | null>(null);
  const seenRef = useRef(new Set<string>());
  const seenOrderRef = useRef<string[]>([]);
  const suspendedRef = useRef(options.suspended);
  const reducedMotionRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const presentNextRef = useRef<() => void>(() => {});

  const presentNext = useCallback(() => {
    if (
      activeRef.current ||
      suspendedRef.current ||
      queueRef.current.length === 0
    ) {
      return;
    }

    const next = queueRef.current.shift();
    if (!next) return;
    activeRef.current = next;
    setActiveEvent(next);
    setAnnouncement(liveMessage(next));

    const duration = NORMAL_DURATION_MS[next.intensity];

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      activeRef.current = null;
      setActiveEvent(null);
      window.requestAnimationFrame(() => presentNextRef.current());
    }, duration);
  }, []);

  useEffect(() => {
    presentNextRef.current = presentNext;
  }, [presentNext]);

  useEffect(() => {
    suspendedRef.current = options.suspended;
    if (!options.suspended) {
      const frame = window.requestAnimationFrame(() =>
        presentNextRef.current(),
      );
      return () => window.cancelAnimationFrame(frame);
    }
  }, [options.suspended]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedMotionRef.current = media.matches;
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    return subscribeBattlePassXpEvents(roomId, (event) => {
      if (event.xp <= 0 || seenRef.current.has(event.id)) return;

      seenRef.current.add(event.id);
      seenOrderRef.current.push(event.id);
      if (seenOrderRef.current.length > 256) {
        const oldest = seenOrderRef.current.shift();
        if (oldest) seenRef.current.delete(oldest);
      }

      queueRef.current.push(event);
      window.requestAnimationFrame(() => presentNextRef.current());
    });
  }, [roomId]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      queueRef.current = [];
      activeRef.current = null;
    },
    [],
  );

  return { activeEvent, announcement };
}
