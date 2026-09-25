"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PublicCommanderProfileSnapshot } from "@/src/lib/profile/profile-command-contract";
import { ProfileDisplayStage } from "./profile-display-stage";
import { ProfileTitleRenderer } from "./profile-title-renderer";
import styles from "./public-commander-profile.module.css";

type BusyAction = "request" | "accept" | "invite" | null;

export function PublicCommanderProfileView({
  snapshot,
  incomingRequestId,
}: {
  snapshot: PublicCommanderProfileSnapshot;
  incomingRequestId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<BusyAction>(null);
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);
  const [invitePending, setInvitePending] = useState(false);
  const identityRef = useRef<HTMLElement>(null);
  const [arsenalTop, setArsenalTop] = useState<number | null>(null);

  const identity = snapshot.identity;

  useLayoutEffect(() => {
    const node = identityRef.current;
    if (!node) return undefined;

    const syncArsenalTop = () => {
      const compact = window.matchMedia("(max-width: 720px)").matches;
      const gap = compact ? 10 : 14;
      const nextTop = Math.ceil(node.getBoundingClientRect().bottom + gap);
      setArsenalTop((current) => (current === nextTop ? current : nextTop));
    };

    const observer = new ResizeObserver(syncArsenalTop);
    observer.observe(node);
    window.addEventListener("resize", syncArsenalTop);
    syncArsenalTop();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncArsenalTop);
    };
  }, []);

  useEffect(() => {
    if (snapshot.relationship !== "friend") return;

    let active = true;
    void fetch("/api/profile/game-invitations", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          outgoing?: ReadonlyArray<{
            invitee?: { handle?: string };
          }>;
        };
      })
      .then((body) => {
        if (!active || !body?.outgoing) return;
        setInvitePending(
          body.outgoing.some(
            (invitation) => invitation.invitee?.handle === identity.handle,
          ),
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [identity.handle, snapshot.relationship]);

  async function sendFriendRequest() {
    if (busy) return;
    setBusy("request");
    setFeedback(null);
    try {
      const response = await fetch("/api/profile/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: identity.handle }),
      });
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "Não foi possível enviar a solicitação.");
      }
      setFeedback({
        kind: "success",
        message: `Solicitação enviada para @${identity.handle}.`,
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar a solicitação.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function acceptFriendRequest() {
    if (busy || !incomingRequestId) return;
    setBusy("accept");
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/profile/friends/requests/${encodeURIComponent(incomingRequestId)}/accept`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "Não foi possível aceitar a solicitação.");
      }
      setFeedback({ kind: "success", message: "Aliança confirmada." });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível aceitar a solicitação.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function inviteToGame() {
    if (busy) return;
    setBusy("invite");
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/profile/commanders/${encodeURIComponent(identity.handle)}/game-invitations`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as
        | { roomCode?: string; message?: string }
        | null;
      if (!response.ok || !body?.roomCode) {
        throw new Error(body?.message ?? "Não foi possível criar o convite.");
      }

      router.push(`/lobby/${encodeURIComponent(body.roomCode)}`);
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível criar o convite.",
      });
      setBusy(null);
    }
  }

  return (
    <main className={styles.page} data-public-profile-display>
      <div
        className={styles.background}
        style={{
          backgroundImage: `url("${snapshot.appearance.background.assetRef}")`,
        }}
        aria-hidden="true"
      />
      <div className={styles.scrim} aria-hidden="true" />

      <header className={styles.header}>
        <section
          ref={identityRef}
          className={styles.identity}
          aria-labelledby="public-profile-name"
        >
          <small className={styles.classification}>SIGILO // ARQUIVO PÚBLICO</small>
          <span className={styles.identityTopline}>
            <strong id="public-profile-name">{identity.displayName}</strong>
            <small data-presence={identity.presence.state}>
              <i aria-hidden="true" />
              @{identity.handle}
            </small>
          </span>

          {snapshot.appearance.title ? (
            <ProfileTitleRenderer
              title={snapshot.appearance.title}
              className={styles.title}
            />
          ) : (
            <strong className={styles.untitled}>SEM TÍTULO EQUIPADO</strong>
          )}
        </section>

        <nav className={styles.actions} aria-label="Ações do perfil">
          <button
            type="button"
            className={styles.backAction}
            onClick={() => router.back()}
          >
            <svg
              className={styles.backIcon}
              viewBox="0 0 20 20"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M11.75 4.5 6.25 10l5.5 5.5M6.75 10H16" />
            </svg>
            <span>VOLTAR</span>
          </button>

          {snapshot.relationship === "friend" ? (
            <button
              type="button"
              className={styles.primaryAction}
              disabled={busy !== null || invitePending}
              onClick={() => void inviteToGame()}
            >
              {invitePending
                ? "CONVITE ENVIADO"
                : busy === "invite"
                  ? "CRIANDO SALA..."
                  : "CHAMAR PARA JOGAR"}
            </button>
          ) : null}

          {snapshot.relationship === "none" ? (
            <button
              type="button"
              className={styles.primaryAction}
              disabled={busy !== null}
              onClick={() => void sendFriendRequest()}
            >
              {busy === "request" ? "ENVIANDO..." : "SOLICITAR AMIZADE"}
            </button>
          ) : null}

          {snapshot.relationship === "incoming-request" ? (
            <button
              type="button"
              className={styles.primaryAction}
              disabled={busy !== null || !incomingRequestId}
              onClick={() => void acceptFriendRequest()}
            >
              {busy === "accept" ? "ACEITANDO..." : "ACEITAR AMIZADE"}
            </button>
          ) : null}

          {snapshot.relationship === "outgoing-request" ? (
            <button type="button" className={styles.pendingAction} disabled>
              SOLICITAÇÃO ENVIADA
            </button>
          ) : null}
        </nav>
      </header>

      {feedback ? (
        <p
          className={styles.feedback}
          data-kind={feedback.kind}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}

      <ProfileDisplayStage
        arsenal={snapshot.appearance.arsenal}
        topInsetPx={arsenalTop}
      />
    </main>
  );
}
