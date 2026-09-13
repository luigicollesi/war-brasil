"use client";

import type { ProfileCommandSnapshot } from "@/src/lib/profile/profile-command-contract";
import { formatOperationDate, initialsFrom } from "./profile-command-format";
import styles from "./profile-command-hub.module.css";
import refinementStyles from "./profile-command-refinements.module.css";

const RELATION_COPY = {
  self: "Seu perfil",
  ally: "Mesmo lado",
  opponent: "Outro lado",
} as const;

export function ProfileCampaignStation({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: ProfileCommandSnapshot;
  selected: string | null;
  onSelect: (operationCode: string) => void;
}) {
  const history = snapshot.history.data;
  const selectedMatch = history.matches.find((match) => match.operationCode === selected) ?? null;

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
              onClick={() => onSelect(match.operationCode)}
              data-selected={selected === match.operationCode ? "true" : "false"}
              aria-pressed={selected === match.operationCode}
            >
              <span>
                <small>{formatOperationDate(match.playedAt)}</small>
                <strong>{match.operationCode}</strong>
              </span>
              <em data-result={match.result}>
                {match.result === "victory" ? "Vitória" : "Derrota"}
              </em>
              <span>
                <small>{match.mode === "classic" ? "Clássico" : "Personalizada"}</small>
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
            {selectedMatch.participants.map((participant) => (
              <li key={`${selectedMatch.operationCode}-${participant.handle}`}>
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
        <p className={styles.moreRecords}>Existem registros adicionais; o carregamento continua progressivo.</p>
      ) : null}
    </div>
  );
}
