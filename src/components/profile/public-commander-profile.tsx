"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCommandSceneDirective } from "@/src/components/pre-game/foundation";
import type {
  PublicCommanderProfileSnapshot,
  PublicMatchSummary,
  PublicPlayerMatchHistory,
} from "@/src/lib/profile/profile-command-contract";
import {
  commanderStatusLabel,
  formatOperationDate,
  initialsFrom,
} from "./command-quarters/profile-command-format";
import styles from "./public-commander-profile.module.css";

const RELATIONSHIP_COPY: Record<PublicCommanderProfileSnapshot["relationship"], string> = {
  self: "Seu próprio comando",
  none: "Sem vínculo de comando",
  "outgoing-request": "Solicitação enviada",
  "incoming-request": "Solicitação recebida",
  friend: "Rede de Comando",
};

const RESULT_COPY: Record<PublicMatchSummary["result"], string> = {
  victory: "Vitória",
  defeat: "Derrota",
  unknown: "Indisponível",
};

const MODE_COPY: Record<PublicMatchSummary["mode"], string> = {
  classic: "Clássico",
  custom: "Personalizada",
  unknown: "Modo não registrado",
};

export function PublicCommanderProfileView({
  snapshot,
}: {
  snapshot: PublicCommanderProfileSnapshot;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"request" | "remove" | "block" | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);
  const [history, setHistory] = useState<PublicPlayerMatchHistory>(snapshot.history.data);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useCommandSceneDirective({
    focus: "insignia",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 1,
  });

  const identity = snapshot.identity;

  async function mutate(
    action: "request" | "remove" | "block",
    url: string,
    init: RequestInit,
    successMessage: string,
  ) {
    if (busy) return;
    setBusy(action);
    setFeedback(null);
    try {
      const response = await fetch(url, init);
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "A operação social não pôde ser concluída.");
      }
      setFeedback({ kind: "success", message: successMessage });
      if (action === "block") {
        router.push("/profile");
      } else {
        router.refresh();
      }
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "A operação social não pôde ser concluída.",
      });
    } finally {
      setBusy(null);
    }
  }

  function sendFriendRequest() {
    return mutate(
      "request",
      "/api/profile/friends/requests",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: identity.handle }),
      },
      `Solicitação enviada para @${identity.handle}.`,
    );
  }

  function removeFriend() {
    return mutate(
      "remove",
      `/api/profile/friends/${encodeURIComponent(identity.handle)}`,
      { method: "DELETE" },
      `@${identity.handle} removido da Rede de Comando.`,
    );
  }

  function blockCommander() {
    return mutate(
      "block",
      "/api/profile/blocks",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: identity.handle }),
      },
      `@${identity.handle} bloqueado.`,
    );
  }

  async function loadMoreHistory() {
    if (
      historyLoading ||
      !history.hasMore ||
      !history.nextCursor ||
      snapshot.history.availability === "unavailable"
    ) {
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(
        `/api/profile/commanders/${encodeURIComponent(identity.handle)}/history?cursor=${encodeURIComponent(history.nextCursor)}`,
        { cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as
        | (PublicPlayerMatchHistory & { message?: string })
        | { message?: string }
        | null;
      if (!response.ok || !body || !("matches" in body) || !Array.isArray(body.matches)) {
        throw new Error(body?.message ?? "Não foi possível carregar outros registros.");
      }

      setHistory((current) => ({
        matches: [...current.matches, ...body.matches],
        hasMore: body.hasMore,
        nextCursor: body.nextCursor,
      }));
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar outros registros.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  const canBlock = snapshot.relationship !== "self";

  return (
    <main className={styles.page} data-scene-fallback="html">
      <header className={styles.header}>
        <Link href="/profile">← Quartel do Comandante</Link>
        <span>Arquivo público · @{identity.handle}</span>
      </header>

      <div className={styles.layout}>
        <section className={styles.dossier} aria-labelledby="public-commander-name">
          <div className={styles.portrait}>
            {identity.portrait.src ? (
              <Image
                src={identity.portrait.src}
                alt={identity.portrait.alt}
                fill
                sizes="(max-width: 760px) 88px, 210px"
              />
            ) : (
              <span aria-label={identity.portrait.alt}>
                {initialsFrom(identity.displayName)}
              </span>
            )}
          </div>

          <div className={styles.identity}>
            <small>@{identity.handle}</small>
            <h1 id="public-commander-name">{identity.displayName}</h1>
            <p>{identity.title ?? "Sem título equipado"}</p>
          </div>

          {identity.bio ? <p className={styles.bio}>{identity.bio}</p> : null}

          <span className={styles.relationship}>
            {RELATIONSHIP_COPY[snapshot.relationship]}
          </span>

          <div className={styles.socialActions} aria-label="Ações da Rede de Comando">
            {snapshot.relationship === "none" ? (
              <button
                type="button"
                className={styles.primaryAction}
                disabled={busy !== null}
                onClick={() => void sendFriendRequest()}
              >
                {busy === "request" ? "Enviando sinal" : "Conectar comandante"}
              </button>
            ) : null}
            {snapshot.relationship === "friend" ? (
              <button
                type="button"
                className={styles.secondaryAction}
                disabled={busy !== null}
                onClick={() => void removeFriend()}
              >
                {busy === "remove" ? "Removendo" : "Remover da rede"}
              </button>
            ) : null}
            {canBlock ? (
              <button
                type="button"
                className={styles.dangerAction}
                disabled={busy !== null}
                onClick={() => void blockCommander()}
              >
                {busy === "block" ? "Bloqueando" : "Bloquear"}
              </button>
            ) : null}
          </div>

          {feedback ? (
            <p
              className={styles.socialFeedback}
              data-kind={feedback.kind}
              role={feedback.kind === "error" ? "alert" : "status"}
            >
              {feedback.message}
            </p>
          ) : null}

          <div className={styles.statusGrid}>
            <div>
              <small>Estado</small>
              <strong>{commanderStatusLabel(identity.presence, identity.activity)}</strong>
            </div>
            <div>
              <small>Último registro</small>
              <strong>
                {identity.presence.lastSeenAt
                  ? formatOperationDate(identity.presence.lastSeenAt)
                  : "Indisponível"}
              </strong>
            </div>
          </div>
        </section>

        <section className={styles.history} aria-labelledby="public-history-title">
          <div className={styles.historyHeader}>
            <span>Memória operacional</span>
            <strong id="public-history-title">Livro de Campanha</strong>
          </div>

          {snapshot.history.availability === "unavailable" ? (
            <div className={styles.empty}>
              <strong>Arquivo restrito</strong>
              <span>{snapshot.history.unavailableReason}</span>
            </div>
          ) : history.matches.length === 0 ? (
            <div className={styles.empty}>
              <strong>Nenhum registro público</strong>
              <span>Este comandante ainda não possui operações registradas.</span>
            </div>
          ) : (
            <ol className={styles.records} aria-label="Operações públicas recentes">
              {history.matches.map((match) => (
                <li key={`${match.operationCode}-${match.playedAt}`} className={styles.record}>
                  <span>
                    <small>{formatOperationDate(match.playedAt)}</small>
                    <strong>{match.operationCode}</strong>
                  </span>
                  <em data-result={match.result}>{RESULT_COPY[match.result]}</em>
                  <span>
                    <small>{MODE_COPY[match.mode]}</small>
                    <strong>{match.durationMinutes} min</strong>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {snapshot.history.availability !== "unavailable" && history.hasMore ? (
            <button
              type="button"
              className={styles.historyLoadMore}
              disabled={historyLoading}
              onClick={() => void loadMoreHistory()}
            >
              {historyLoading ? "Consultando arquivo..." : "Carregar mais registros"}
            </button>
          ) : null}
          {historyError ? (
            <p className={styles.historyError} role="alert">
              {historyError}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
