"use client";

import { type FormEvent, useState } from "react";
import type {
  CommanderSearchResult,
  ProfileCommandSnapshot,
} from "@/src/lib/profile/profile-command-contract";
import { initialsFrom, PRESENCE_COPY } from "./profile-command-format";
import styles from "./profile-command-hub.module.css";
import refinementStyles from "./profile-command-refinements.module.css";

export function ProfileNetworkStation({ snapshot }: { snapshot: ProfileCommandSnapshot }) {
  const social = snapshot.social.data;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReadonlyArray<CommanderSearchResult>>([]);
  const [searching, setSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) return;

    setSearching(true);
    setSearchAttempted(true);
    setSearchFailed(false);

    try {
      const response = await fetch(
        `/api/profile/commanders/search?q=${encodeURIComponent(normalized)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("COMMANDER_SEARCH_FAILED");

      const payload = (await response.json()) as {
        results?: ReadonlyArray<CommanderSearchResult>;
      };
      setResults(payload.results ?? []);
    } catch {
      setResults([]);
      setSearchFailed(true);
    } finally {
      setSearching(false);
    }
  }

  function updateQuery(value: string) {
    setQuery(value);
    setResults([]);
    setSearchAttempted(false);
    setSearchFailed(false);
  }

  if (snapshot.social.availability === "unavailable") {
    return (
      <div className={styles.unavailableState}>
        <span>REDE FORA DE SERVIÇO</span>
        <small>{snapshot.social.unavailableReason}</small>
      </div>
    );
  }

  return (
    <div className={styles.networkContent}>
      <div className={styles.rosterMeta}>
        <span>{social.friends.filter((friend) => friend.presence !== "offline").length} online</span>
        <span>{social.totalFriends} contatos</span>
        <span>{social.incomingRequests.length} sinais</span>
      </div>

      <div className={refinementStyles.sectionLabel}>
        <span>Rede imediata</span>
        <span>{social.friends.length} visíveis</span>
      </div>

      {snapshot.social.availability === "empty" ? (
        <div className={styles.emptyState}>
          <strong>Nenhum comandante conectado</strong>
          <span>A Central de Comunicações continua disponível para busca.</span>
        </div>
      ) : (
        <ul className={styles.friendList} aria-label="Amigos na Rede de Comando">
          {social.friends.slice(0, 4).map((friend) => (
            <li key={friend.handle}>
              <span
                className={styles.presenceDot}
                data-presence={friend.presence}
                aria-hidden="true"
              />
              <span>
                <strong>{friend.displayName}</strong>
                <small>{friend.contextLabel}</small>
              </span>
              <em>{PRESENCE_COPY[friend.presence]}</em>
            </li>
          ))}
        </ul>
      )}

      {social.incomingRequests.length > 0 ? (
        <>
          <div className={refinementStyles.sectionLabel}>
            <span>Sinais recebidos</span>
            <span>{social.incomingRequests.length}</span>
          </div>
          <ul className={styles.searchResults} aria-label="Solicitações de conexão">
            {social.incomingRequests.slice(0, 3).map((request) => (
              <li key={request.handle}>
                <span className={styles.searchMonogram} aria-hidden="true">
                  {initialsFrom(request.displayName)}
                </span>
                <span>
                  <strong>{request.displayName}</strong>
                  <small>
                    @{request.handle} · {request.mutualContacts} contatos em comum · solicitação pendente
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {social.recentContacts.length > 0 ? (
        <>
          <div className={refinementStyles.sectionLabel}>
            <span>Contatos recentes</span>
            <span>últimas operações</span>
          </div>
          <ul className={styles.searchResults} aria-label="Comandantes encontrados recentemente">
            {social.recentContacts.slice(0, 3).map((contact) => (
              <li key={`${contact.operationCode}-${contact.handle}`}>
                <span className={styles.searchMonogram} aria-hidden="true">
                  {contact.relation === "ally" ? "AL" : "OP"}
                </span>
                <span>
                  <strong>{contact.displayName}</strong>
                  <small>{contact.operationCode} · {contact.contextLabel}</small>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <form className={styles.searchForm} onSubmit={handleSearch}>
        <label htmlFor="commander-search">Central de Comunicações · localizar comandante</label>
        <div>
          <input
            id="commander-search"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="callsign / nome"
            autoComplete="off"
            maxLength={64}
            aria-describedby="commander-search-status"
          />
          <button type="submit" disabled={query.trim().length < 2 || searching}>
            {searching ? "Rastreando" : "Rastrear"}
          </button>
        </div>
      </form>

      <div id="commander-search-status" aria-live="polite" aria-atomic="true">
        {results.length > 0 ? (
          <ul className={styles.searchResults} aria-label="Comandantes encontrados">
            {results.map((result) => (
              <li key={result.handle}>
                <span className={styles.searchMonogram} aria-hidden="true">
                  {initialsFrom(result.displayName)}
                </span>
                <span>
                  <strong>{result.displayName}</strong>
                  <small>@{result.handle} · {result.mutualContacts} contatos em comum</small>
                </span>
              </li>
            ))}
          </ul>
        ) : searchAttempted && !searching ? (
          <p className={refinementStyles.searchStatus} role="status">
            {searchFailed
              ? "Falha ao consultar a Central de Comunicações."
              : "Nenhum comandante localizado para este sinal."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
