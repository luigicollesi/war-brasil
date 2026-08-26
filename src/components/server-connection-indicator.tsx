"use client";

import { useEffect, useMemo, useState } from "react";

type ConnectionState = "checking" | "excellent" | "good" | "unstable" | "slow" | "reconnecting" | "offline";

const CHECK_INTERVAL_MS = 3_000;
const REQUEST_TIMEOUT_MS = 4_000;

function stateFor(latency: number | null, failures: number): ConnectionState {
  if (failures >= 3) return "offline";
  if (failures > 0) return "reconnecting";
  if (latency === null) return "checking";
  if (latency < 180) return "excellent";
  if (latency < 400) return "good";
  if (latency < 900) return "unstable";
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
  const [smoothedLatency, setSmoothedLatency] = useState<number | null>(null);
  const [failures, setFailures] = useState(0);

  useEffect(() => {
    let active = true;
    let timeoutId = 0;

    async function check() {
      if (!navigator.onLine) {
        if (active) setFailures(3);
        timeoutId = window.setTimeout(check, CHECK_INTERVAL_MS);
        return;
      }

      const controller = new AbortController();
      const requestTimeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const startedAt = performance.now();

      try {
        const response = await fetch("/api/health", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Health check indisponível");

        const latency = performance.now() - startedAt;
        if (active) {
          setFailures(0);
          setSmoothedLatency((previous) => previous === null ? latency : previous * 0.7 + latency * 0.3);
        }
      } catch {
        if (active) setFailures((value) => Math.min(3, value + 1));
      } finally {
        window.clearTimeout(requestTimeout);
        if (active) timeoutId = window.setTimeout(check, CHECK_INTERVAL_MS);
      }
    }

    const offline = () => setFailures(3);
    const online = () => {
      setFailures(0);
      void check();
    };

    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    void check();

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  const state = stateFor(smoothedLatency, failures);
  const latencyLabel = smoothedLatency === null || state === "offline"
    ? null
    : `${Math.round(smoothedLatency)} ms`;
  const title = useMemo(
    () => latencyLabel ? `${labels[state]} · ${latencyLabel}` : labels[state],
    [latencyLabel, state],
  );

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
            className={`w-[3px] rounded-full transition-all ${bar <= activeBars[state] ? "bg-current opacity-100" : "bg-white/20 opacity-50"}`}
            style={{ height: `${5 + bar * 3}px` }}
          />
        ))}
      </span>
      <span className="hidden min-w-0 flex-col leading-none sm:flex">
        <strong className="max-w-36 truncate text-[10px] font-bold uppercase tracking-[0.08em]">
          {labels[state]}
        </strong>
        {latencyLabel ? <small className="mt-1 text-[10px] text-white/55">{latencyLabel}</small> : null}
      </span>
    </div>
  );
}
