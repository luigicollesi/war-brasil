"use client";

import { useState } from "react";
import type {
  MatchSummary,
  PlayerMatchHistory,
  ProfileCommandSnapshot,
} from "@/src/lib/profile/profile-command-contract";
import { formatOperationDate, initialsFrom } from "./profile-command-format";
import styles from "./profile-command-hub.module.css";
import refinementStyles from "./profile-command-refinements.module.css";

const RELATION_COPY = {
  self: "Seu perfil",
  ally: "Mesmo lado",
  opponent: "Outro lado",
} as const;

const RESULT_COPY = {
  victory: "Vitória",
  defeat: "Derrota",
  unknown: "Resultado indisponível",
} as const;

const MODE_COPY = {
  classic: "Clássico",
  custom: "Personalizada",
  unknown: "Modo não registrado",
} as const;

export function ProfileCampaignStation({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: ProfileCommandSnapshot;
  selected: string | null;
  onSelect: (match: MatchSummary) => void;
}) {
  const [history, setHistory] = useState<PlayerMatchHistory>(snapshot.history.data);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const selectedMatch = history.matches.find((match) => match.operationCode === selected) ?? null;

  async function loadMore() {
    if (!history.hasMore || !history.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreFailed(false);

    try {
      const response = await fetch(
        `/api/profile/history?cursor=${encodeURIComponent(history.nextCursor)}&limit=20`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("PROFILE_HISTORY_PAGE_FAILED");

      const next = (await response.json()) as PlayerMatchHistory;
      setHistory((current) => {
        const known = new Set(current.matches.map((match) => match.operationCode));
        const appended = next.matches.filter((match) => !known.has(match.operationCode));
        return {
          matches: [...current.matches, ...appended],
          hasMore: next.hasMore,
          nextCursor: next.nextCursor,
        };
      });
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (snapshot.history.availability === "unavailable") {
    return (
      <div className={styles.unavailableState}>
        <span>ARQUIVO INDISPONÍVEL</span>
        <small>{snapshot.history.unavailableReason}</small>
      </div>
    );
  }

  if (snapshot.history.availability === "empty" || history.matches.length === 0) {
    return (
      <div className={styles.emptyState}>
        <strong>Nenhuma partida registrada</strong>
        <span>O Livro de Campanha está disponível e aguarda o primeiro registro.</span>
      </div>
    );
  }

  return (
    <div className={styles.campaignContent}>
      <ol className={styles.operationList} aria-label="Partidas recentes">
        {history.matches.map((match) => (
          <li key={match.operationCode}>
            <button
              type="button"
              onClick={() => onSelect(match)}
              data-selected={selected === match.operationCode ? "true" : "false"}
              aria-pressed={selected === match.operationCode}
            >
              <span>
                <small>{formatOperationDate(match.playedAt)}</small>
                <strong>{match.operationCode}</strong>
              </span>
              <em data-result={match.result}>{RESULT_COPY[match.result]}</em>
              <span>
                <small>{MODE_COPY[match.mode]}</small>
                <strong>{match.durationMinutes} min</strong>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {selectedMatch ? (
        <section className={refinementStyles.operationDossier} aria-label={`Detalhes de ${selectedMatch.operationCode}`}>
          <div className={refinementStyles.operationDossierHeader}>
            <span>Registro selecionado</span>
            <strong>{selectedMatch.operationCode} · {selectedMatch.participants.length} jogadores</strong>
          </div>
          <ul className={styles.searchResults} aria-label="Participantes da partida">
            {selectedMatch.participants.map((participant, index) => (
              <li key={`${selectedMatch.operationCode}-${participant.handle ?? participant.displayName}-${index}`}>
                <span className={styles.searchMonogram} aria-hidden="true">
                  {initialsFrom(participant.displayName)}
                </span>
                <span>
                  <strong>{participant.displayName}</strong>
                  <small>
                    {RELATION_COPY[participant.relation]}
                    {participant.relation !== "self"
                      ? participant.isFriend
                        ? " · integrante da sua Rede de Comando"
                        : " · fora da sua rede"
                      : ""}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {history.hasMore ? (
        <button
          type="button"
          className={refinementStyles.historyLoadMore}
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Carregando registros" : "Carregar mais registros"}
        </button>
      ) : null}

      {loadMoreFailed ? (
        <p className={refinementStyles.searchStatus} role="status">
          Não foi possível carregar os registros adicionais. Tente novamente.
        </p>
      ) : null}
    </div>
  );
}
