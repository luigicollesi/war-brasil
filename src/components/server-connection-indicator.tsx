"use client";

import { useSyncExternalStore } from "react";
import {
  gameSyncMetricsStore,
  type GameSyncMetrics,
} from "@/src/lib/game-sync-metrics-store";

type ConnectionState =
  | "checking"
  | "excellent"
  | "good"
  | "unstable"
  | "slow"
  | "reconnecting"
  | "offline";

const SERVER_METRICS: GameSyncMetrics = {
  latencyMs: null,
  failures: 0,
  online: true,
};

function stateFor(metrics: GameSyncMetrics): ConnectionState {
  if (!metrics.online || metrics.failures >= 3) return "offline";
  if (metrics.failures > 0) return "reconnecting";
  if (metrics.latencyMs === null) return "checking";
  if (metrics.latencyMs < 180) return "excellent";
  if (metrics.latencyMs < 400) return "good";
  if (metrics.latencyMs < 900) return "unstable";
  return "slow";
}

const labels: Record<ConnectionState, string> = {
  checking: "Verificando servidor",
  excellent: "Conexão excelente",
  good: "Conexão boa",
  unstable: "Conexão instável",
  slow: "Servidor lento",
  reconnecting: "Reconectando",
  offline: "Sem conexão",
};

const activeBars: Record<ConnectionState, number> = {
  checking: 1,
  excellent: 4,
  good: 3,
  unstable: 2,
  slow: 1,
  reconnecting: 1,
  offline: 0,
};

const stateTone: Record<ConnectionState, string> = {
  checking: "text-[#b8c8c1] border-white/10",
  excellent: "text-[#67d48b] border-[#67d48b]/20",
  good: "text-[#a9cf72] border-[#a9cf72]/20",
  unstable: "text-[#e1c75d] border-[#e1c75d]/25",
  slow: "text-[#e8994b] border-[#e8994b]/25",
  reconnecting: "text-[#e1c75d] border-[#e1c75d]/25",
  offline: "text-[#e56d61] border-[#e56d61]/25",
};

export function ServerConnectionIndicator() {
  const metrics = useSyncExternalStore(
    gameSyncMetricsStore.subscribe,
    gameSyncMetricsStore.getSnapshot,
    () => SERVER_METRICS,
  );
  const state = stateFor(metrics);
  const latencyLabel =
    metrics.latencyMs === null || state === "offline"
      ? null
      : `${Math.round(metrics.latencyMs)} ms`;
  const title = latencyLabel
    ? `${labels[state]} · ${latencyLabel}`
    : labels[state];

  return (
    <div
      className={`fixed right-3 top-2 z-[70] flex h-11 items-end gap-2 rounded-xl border bg-[rgba(6,27,21,0.92)] px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,.28)] backdrop-blur-xl sm:right-4 sm:top-2.5 ${stateTone[state]}`}
      data-state={state}
      title={title}
      aria-label={title}
    >
      <span className="flex h-5 items-end gap-[3px]" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={`w-[3px] rounded-full transition-all ${
              bar <= activeBars[state]
                ? "bg-current opacity-100"
                : "bg-white/20 opacity-50"
            }`}
            style={{ height: `${5 + bar * 3}px` }}
          />
        ))}
      </span>
      <span className="hidden min-w-0 flex-col leading-none sm:flex">
        <strong className="max-w-36 truncate text-[10px] font-bold uppercase tracking-[0.08em]">
          {labels[state]}
        </strong>
        {latencyLabel ? (
          <small className="mt-1 text-[10px] text-white/55">{latencyLabel}</small>
        ) : null}
      </span>
    </div>
  );
}
