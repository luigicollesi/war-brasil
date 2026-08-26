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
    <div className="server-connection-indicator" data-state={state} title={title} aria-label={title}>
      <span className="server-signal-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => (
          <span key={bar} className={bar <= activeBars[state] ? "is-active" : ""} />
        ))}
      </span>
      <span className="server-connection-copy">
        <strong>{labels[state]}</strong>
        {latencyLabel ? <small>{latencyLabel}</small> : null}
      </span>
    </div>
  );
}
