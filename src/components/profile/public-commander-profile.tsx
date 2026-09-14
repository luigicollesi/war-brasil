"use client";

import Image from "next/image";
import Link from "next/link";
import { useCommandSceneDirective } from "@/src/components/pre-game/foundation";
import type {
  PublicCommanderProfileSnapshot,
  PublicMatchSummary,
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
  useCommandSceneDirective({
    focus: "insignia",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 1,
  });

  const identity = snapshot.identity;
  const history = snapshot.history.data;

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

          <span className={styles.relationship}>
            {RELATIONSHIP_COPY[snapshot.relationship]}
          </span>

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
                <li key={match.operationCode} className={styles.record}>
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
        </section>
      </div>
    </main>
  );
}
