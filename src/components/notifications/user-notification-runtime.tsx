"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameInvitationSummary } from "@/src/lib/game-invitations/game-invitation-contract";
import type { UserNotification } from "@/src/lib/profile/user-notification-contract";
import { GAME_REALTIME_SUBPROTOCOL } from "@/src/lib/game-realtime-contract";
import { useSession } from "@/src/lib/client/auth-client";
import { gameRealtimeMode } from "@/src/lib/client/transport/game-realtime-mode";
import styles from "./user-notification-runtime.module.css";

type InvitationResponse = {
  incoming?: GameInvitationSummary[];
  outgoing?: GameInvitationSummary[];
};

type NotificationResponse = {
  notifications?: UserNotification[];
};

function websocketHostname() {
  const hostname = window.location.hostname;
  return hostname.includes(":") ? `[${hostname}]` : hostname;
}

function userRealtimeUrl(ticket: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const configured = process.env.NEXT_PUBLIC_GAME_REALTIME_URL?.trim();
  const configuredPort = process.env.NEXT_PUBLIC_GAME_REALTIME_PORT?.trim();
  const url = configured
    ? new URL(configured, window.location.href)
    : configuredPort
      ? new URL(
          `${protocol}//${websocketHostname()}:${configuredPort}/user-realtime`,
        )
      : new URL(`${protocol}//${window.location.host}/user-realtime`);

  url.pathname = "/user-realtime";
  url.search = "";
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

async function fetchUserRealtimeTicket() {
  const response = await fetch("/api/profile/realtime-ticket", {
    method: "POST",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Ticket realtime indisponível.");
  const body = (await response.json()) as {
    enabled?: unknown;
    ticket?: unknown;
  };
  if (body.enabled === false) return null;
  if (typeof body.ticket !== "string" || body.ticket.length < 32) {
    throw new Error("Ticket realtime inválido.");
  }
  return body.ticket;
}

export function UserNotificationRuntime() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [incoming, setIncoming] = useState<GameInvitationSummary[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const activeInvitation = incoming[0] ?? null;
  const activeNotification = notifications[0] ?? null;

  const refresh = useCallback(async () => {
    if (!session?.user) return;

    const [invitationResponse, notificationResponse] = await Promise.all([
      fetch("/api/profile/game-invitations", { cache: "no-store" }),
      fetch("/api/profile/notifications", { cache: "no-store" }),
    ]);

    if (invitationResponse.ok) {
      const body = (await invitationResponse.json()) as InvitationResponse;
      setIncoming(Array.isArray(body.incoming) ? body.incoming : []);
    }

    if (notificationResponse.ok) {
      const body = (await notificationResponse.json()) as NotificationResponse;
      setNotifications(
        Array.isArray(body.notifications) ? body.notifications : [],
      );
    }
  }, [session?.user]);

  useEffect(() => {
    if (isPending || !session?.user) return;

    let stopped = false;
    const poll = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      await refresh().catch(() => undefined);
    };

    void poll();
    const intervalId = window.setInterval(
      () => {
        void poll();
      },
      realtimeConnected ? 60_000 : 15_000,
    );

    const onFocus = () => void poll();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isPending, realtimeConnected, refresh, session?.user]);

  useEffect(() => {
    if (
      isPending ||
      !session?.user ||
      gameRealtimeMode() === "off"
    ) {
      return;
    }

    let stopped = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let refreshPending = false;

    const scheduleReconnect = () => {
      if (
        stopped ||
        reconnectTimer ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      reconnectAttempt += 1;
      const baseDelay = Math.min(
        30_000,
        1_000 * 2 ** Math.min(reconnectAttempt - 1, 5),
      );
      const jitter = 0.85 + Math.random() * 0.3;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, Math.round(baseDelay * jitter));
    };

    const connect = async () => {
      if (stopped || document.visibilityState !== "visible") return;

      try {
        const ticket = await fetchUserRealtimeTicket();
        if (stopped) return;
        if (!ticket) {
          setRealtimeConnected(false);
          return;
        }

        const nextSocket = new WebSocket(
          userRealtimeUrl(ticket),
          GAME_REALTIME_SUBPROTOCOL,
        );
        socket = nextSocket;

        nextSocket.onopen = () => {
          if (socket !== nextSocket || stopped) return;
          if (nextSocket.protocol !== GAME_REALTIME_SUBPROTOCOL) {
            nextSocket.close(1002, "Subprotocolo realtime incompatível");
            return;
          }
          reconnectAttempt = 0;
          setRealtimeConnected(true);
        };
        nextSocket.onmessage = (message) => {
          if (typeof message.data !== "string") return;
          try {
            const event = JSON.parse(message.data) as {
              type?: unknown;
            };
            if (event.type === "user.notifications.changed") {
              if (document.visibilityState === "visible") {
                void refresh();
              } else {
                refreshPending = true;
              }
            }
          } catch {
            // Invalid push data is ignored; REST polling remains authoritative.
          }
        };
        nextSocket.onerror = () => {
          if (!stopped) setRealtimeConnected(false);
        };
        nextSocket.onclose = () => {
          if (socket === nextSocket) socket = null;
          if (!stopped) setRealtimeConnected(false);
          scheduleReconnect();
        };
      } catch {
        if (!stopped) setRealtimeConnected(false);
        scheduleReconnect();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || stopped) return;

      if (refreshPending) {
        refreshPending = false;
        void refresh();
      }

      if (!socket && !reconnectTimer) {
        reconnectAttempt = 0;
        void connect();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    void connect();

    return () => {
      stopped = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      socket?.close(1000, "notification runtime closed");
    };
  }, [isPending, refresh, session?.user]);

  const notificationMessage = useMemo(() => {
    if (!activeNotification) return null;
    if (activeNotification.kind === "game_invitation_rejected") {
      const name =
        activeNotification.payload.displayName ??
        activeNotification.payload.handle ??
        "O comandante";
      return `${name} recusou seu convite para jogar.`;
    }
    if (activeNotification.kind === "game_invitation_cancelled") {
      return "Um convite de partida deixou de estar disponível.";
    }
    return "Você recebeu uma nova notificação.";
  }, [activeNotification]);

  async function acceptInvitation(invitation: GameInvitationSummary) {
    if (busyInvitationId) return;
    setBusyInvitationId(invitation.id);
    setInvitationError(null);

    try {
      const response = await fetch(
        `/api/profile/game-invitations/${encodeURIComponent(invitation.id)}/accept`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as
        | { roomCode?: string; message?: string }
        | null;

      if (!response.ok || !body?.roomCode) {
        throw new Error(
          body?.message ?? "Não foi possível entrar na sala convidada.",
        );
      }

      setIncoming((current) =>
        current.filter((item) => item.id !== invitation.id),
      );
      router.push(`/lobby/${encodeURIComponent(body.roomCode)}`);
    } catch (error) {
      setIncoming((current) =>
        current.filter((item) => item.id !== invitation.id),
      );
      setInvitationError(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar na sala convidada.",
      );
      void refresh();
    } finally {
      setBusyInvitationId(null);
    }
  }

  async function rejectInvitation(invitation: GameInvitationSummary) {
    if (busyInvitationId) return;
    setBusyInvitationId(invitation.id);
    setInvitationError(null);

    try {
      const response = await fetch(
        `/api/profile/game-invitations/${encodeURIComponent(invitation.id)}/reject`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "Não foi possível recusar o convite.");
      }
      setIncoming((current) =>
        current.filter((item) => item.id !== invitation.id),
      );
    } catch (error) {
      setInvitationError(
        error instanceof Error
          ? error.message
          : "Não foi possível recusar o convite.",
      );
    } finally {
      setBusyInvitationId(null);
    }
  }

  async function dismissNotification(notification: UserNotification) {
    setNotifications((current) =>
      current.filter((item) => item.id !== notification.id),
    );
    await fetch(
      `/api/profile/notifications/${encodeURIComponent(notification.id)}/read`,
      { method: "POST" },
    ).catch(() => undefined);
  }

  if (!session?.user) return null;

  return (
    <div className={styles.runtime} aria-live="polite">
      {activeInvitation ? (
        <section
          className={styles.invitation}
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-invitation-title"
        >
          <small>CONVOCAÇÃO DE PARTIDA</small>
          <h2 id="game-invitation-title">
            {activeInvitation.inviter.displayName} chamou você para jogar
          </h2>
          <p>
            Sala personalizada <strong>{activeInvitation.roomCode}</strong>
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.reject}
              disabled={busyInvitationId === activeInvitation.id}
              onClick={() => void rejectInvitation(activeInvitation)}
            >
              RECUSAR
            </button>
            <button
              type="button"
              className={styles.accept}
              disabled={busyInvitationId === activeInvitation.id}
              onClick={() => void acceptInvitation(activeInvitation)}
            >
              {busyInvitationId === activeInvitation.id
                ? "ENTRANDO..."
                : "ENTRAR NA SALA"}
            </button>
          </div>
        </section>
      ) : null}

      {invitationError ? (
        <div className={styles.errorToast} role="alert">
          <strong>Não foi possível entrar</strong>
          <span>{invitationError}</span>
          <button type="button" onClick={() => setInvitationError(null)}>
            FECHAR
          </button>
        </div>
      ) : null}

      {activeNotification && notificationMessage ? (
        <div className={styles.toast} role="status">
          <span>{notificationMessage}</span>
          <button
            type="button"
            onClick={() => void dismissNotification(activeNotification)}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
