"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type {
  CommanderSearchResult,
  ProfileCommandSnapshot,
} from "@/src/lib/profile/profile-command-contract";
import { commanderStatusLabel, initialsFrom } from "./profile-command-format";
import styles from "./profile-command-hub.module.css";
import refinementStyles from "./profile-command-refinements.module.css";

type MutationFeedback = Readonly<{
  kind: "error" | "success";
  message: string;
}> | null;

function searchActionLabel(result: CommanderSearchResult) {
  if (result.relationship === "friend") return "Aliado";
  if (result.relationship === "outgoing-request") return "Enviado";
  if (result.relationship === "incoming-request") return "Recebido";
  if (result.relationship === "blocked") return "Bloqueado";
  return "Conectar";
}

export function ProfileNetworkStation({ snapshot }: { snapshot: ProfileCommandSnapshot }) {
  const router = useRouter();
  const social = snapshot.social.data;
  const mutationsEnabled = !snapshot.isEvaluationFixture;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReadonlyArray<CommanderSearchResult>>([]);
  const [searching, setSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [mutationKey, setMutationKey] = useState<string | null>(null);
  const [mutationFeedback, setMutationFeedback] = useState<MutationFeedback>(null);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) return;

    setSearching(true);
    setSearchAttempted(true);
    setSearchFailed(false);
    setMutationFeedback(null);

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

  async function mutate(
    key: string,
    url: string,
    init: RequestInit,
    successMessage: string,
  ) {
    if (!mutationsEnabled || mutationKey) return false;

    setMutationKey(key);
    setMutationFeedback(null);
    try {
      const response = await fetch(url, init);
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "A Central de Comunicações recusou a operação.");
      }
      setMutationFeedback({ kind: "success", message: successMessage });
      router.refresh();
      return true;
    } catch (error) {
      setMutationFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "A Central de Comunicações recusou a operação.",
      });
      return false;
    } finally {
      setMutationKey(null);
    }
  }

  async function sendRequest(result: CommanderSearchResult) {
    const key = `request:${result.handle}`;
    const ok = await mutate(
      key,
      "/api/profile/friends/requests",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: result.handle }),
      },
      `Sinal enviado para @${result.handle}.`,
    );
    if (ok) {
      setResults((current) =>
        current.map((candidate) =>
          candidate.handle === result.handle
            ? { ...candidate, relationship: "outgoing-request" }
            : candidate,
        ),
      );
    }
  }

  async function resolveRequest(requestId: string, action: "accept" | "reject") {
    await mutate(
      `${action}:${requestId}`,
      `/api/profile/friends/requests/${requestId}/${action}`,
      { method: "POST" },
      action === "accept" ? "Aliança confirmada." : "Sinal recusado.",
    );
  }

  async function removeFriend(handle: string) {
    await mutate(
      `remove:${handle}`,
      `/api/profile/friends/${encodeURIComponent(handle)}`,
      { method: "DELETE" },
      `@${handle} removido da Rede de Comando.`,
    );
  }

  async function blockFriend(handle: string) {
    await mutate(
      `block:${handle}`,
      "/api/profile/blocks",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      },
      `@${handle} bloqueado.`,
    );
  }

  function updateQuery(value: string) {
    setQuery(value);
    setResults([]);
    setSearchAttempted(false);
    setSearchFailed(false);
    setMutationFeedback(null);
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
        <span>{social.friends.filter((friend) => friend.presence.state === "online").length} online</span>
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
                data-presence={friend.presence.state}
                aria-hidden="true"
              />
              <span>
                <strong>{friend.displayName}</strong>
                <small>{friend.contextLabel}</small>
              </span>
              <em>{commanderStatusLabel(friend.presence, friend.activity)}</em>
              <span className={refinementStyles.networkActions}>
                <button
                  type="button"
                  className={refinementStyles.networkAction}
                  disabled={!mutationsEnabled || mutationKey !== null}
                  onClick={() => void removeFriend(friend.handle)}
                >
                  {mutationKey === `remove:${friend.handle}` ? "Removendo" : "Remover"}
                </button>
                <button
                  type="button"
                  className={`${refinementStyles.networkAction} ${refinementStyles.networkActionDanger}`}
                  disabled={!mutationsEnabled || mutationKey !== null}
                  onClick={() => void blockFriend(friend.handle)}
                >
                  {mutationKey === `block:${friend.handle}` ? "Bloqueando" : "Bloquear"}
                </button>
              </span>
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
              <li key={request.requestId}>
                <span className={styles.searchMonogram} aria-hidden="true">
                  {initialsFrom(request.displayName)}
                </span>
                <span>
                  <strong>{request.displayName}</strong>
                  <small>
                    @{request.handle} · {request.mutualContacts} contatos em comum · solicitação pendente
                  </small>
                </span>
                <span className={refinementStyles.networkActions}>
                  <button
                    type="button"
                    className={refinementStyles.networkActionPrimary}
                    disabled={!mutationsEnabled || mutationKey !== null}
                    onClick={() => void resolveRequest(request.requestId, "accept")}
                  >
                    {mutationKey === `accept:${request.requestId}` ? "Aceitando" : "Aceitar"}
                  </button>
                  <button
                    type="button"
                    className={refinementStyles.networkAction}
                    disabled={!mutationsEnabled || mutationKey !== null}
                    onClick={() => void resolveRequest(request.requestId, "reject")}
                  >
                    {mutationKey === `reject:${request.requestId}` ? "Recusando" : "Recusar"}
                  </button>
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
        {mutationFeedback ? (
          <p
            className={refinementStyles.networkFeedback}
            data-kind={mutationFeedback.kind}
            role={mutationFeedback.kind === "error" ? "alert" : "status"}
          >
            {mutationFeedback.message}
          </p>
        ) : null}
        {results.length > 0 ? (
          <ul className={styles.searchResults} aria-label="Comandantes encontrados">
            {results.map((result) => {
              const actionable = result.relationship === "none";
              return (
                <li key={result.handle}>
                  <span className={styles.searchMonogram} aria-hidden="true">
                    {initialsFrom(result.displayName)}
                  </span>
                  <span>
                    <strong>{result.displayName}</strong>
                    <small>@{result.handle} · {result.mutualContacts} contatos em comum</small>
                  </span>
                  <button
                    type="button"
                    className={refinementStyles.networkActionPrimary}
                    disabled={
                      !mutationsEnabled ||
                      mutationKey !== null ||
                      !actionable
                    }
                    onClick={() => void sendRequest(result)}
                  >
                    {mutationKey === `request:${result.handle}`
                      ? "Enviando"
                      : searchActionLabel(result)}
                  </button>
                </li>
              );
            })}
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
