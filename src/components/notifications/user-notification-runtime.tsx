"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameInvitationSummary } from "@/src/lib/game-invitations/game-invitation-contract";
import type { UserNotification } from "@/src/lib/profile/user-notification-contract";
import { useSession } from "@/src/lib/client/auth-client";
import styles from "./user-notification-runtime.module.css";

type InvitationResponse = {
  incoming?: GameInvitationSummary[];
  outgoing?: GameInvitationSummary[];
};

type NotificationResponse = {
  notifications?: UserNotification[];
};

export function UserNotificationRuntime() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [incoming, setIncoming] = useState<GameInvitationSummary[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);

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
      if (stopped) return;
      await refresh().catch(() => undefined);
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 2500);

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
