"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import type {
  CommanderIdentity,
  FriendRequestPolicy,
  ProfilePrivacySettings,
  ProfileVisibility,
} from "@/src/lib/profile/profile-command-contract";
import styles from "./profile-settings-panel.module.css";

type Feedback = Readonly<{
  kind: "error" | "success";
  message: string;
}> | null;

type EditablePrivacyUpdate = {
  presenceVisibility?: ProfileVisibility;
  activityVisibility?: ProfileVisibility;
  historyVisibility?: ProfileVisibility;
  friendRequestPolicy?: FriendRequestPolicy;
};

type OwnedTitle = Readonly<{
  id: string;
  name: string;
  description: string | null;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  isActive: boolean;
  equipped: boolean;
}>;

const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: ProfileVisibility;
  label: string;
}> = [
  { value: "public", label: "Público" },
  { value: "friends", label: "Somente aliados" },
  { value: "private", label: "Privado" },
];

const REQUEST_OPTIONS: ReadonlyArray<{
  value: FriendRequestPolicy;
  label: string;
}> = [
  { value: "everyone", label: "Todos" },
  { value: "friends_of_friends", label: "Aliados de aliados" },
  { value: "nobody", label: "Ninguém" },
];

export function ProfileSettingsPanel({
  identity,
  privacy,
}: {
  identity: CommanderIdentity;
  privacy: ProfilePrivacySettings;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [titleBusy, setTitleBusy] = useState(false);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [ownedTitles, setOwnedTitles] = useState<OwnedTitle[]>([]);
  const [equippedTitleId, setEquippedTitleId] = useState("");
  const [selectedTitleId, setSelectedTitleId] = useState("");
  const [displayName, setDisplayName] = useState(identity.displayName);
  const [bio, setBio] = useState(identity.bio ?? "");
  const [presenceVisibility, setPresenceVisibility] = useState<ProfileVisibility>(
    privacy.presenceVisibility,
  );
  const [activityVisibility, setActivityVisibility] = useState<ProfileVisibility>(
    privacy.activityVisibility,
  );
  const [historyVisibility, setHistoryVisibility] = useState<ProfileVisibility>(
    privacy.historyVisibility,
  );
  const [friendRequestPolicy, setFriendRequestPolicy] = useState<FriendRequestPolicy>(
    privacy.friendRequestPolicy,
  );
  const locked = busy || titleBusy;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !locked) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, open]);

  const loadTitles = async () => {
    setTitlesLoading(true);
    try {
      const response = await fetch("/api/profile/titles", {
        method: "GET",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | { titles?: OwnedTitle[]; message?: string }
        | null;
      if (!response.ok || !Array.isArray(body?.titles)) {
        throw new Error(body?.message ?? "Não foi possível carregar os títulos.");
      }

      const equipped = body.titles.find((title) => title.equipped)?.id ?? "";
      setOwnedTitles(body.titles);
      setEquippedTitleId(equipped);
      setSelectedTitleId(equipped);
    } catch (error) {
      setOwnedTitles([]);
      setEquippedTitleId("");
      setSelectedTitleId("");
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os títulos.",
      });
    } finally {
      setTitlesLoading(false);
    }
  };

  const openPanel = () => {
    setDisplayName(identity.displayName);
    setBio(identity.bio ?? "");
    setPresenceVisibility(privacy.presenceVisibility);
    setActivityVisibility(privacy.activityVisibility);
    setHistoryVisibility(privacy.historyVisibility);
    setFriendRequestPolicy(privacy.friendRequestPolicy);
    setFeedback(null);
    setOpen(true);
    void loadTitles();
  };

  const equipTitle = async () => {
    if (titleBusy || titlesLoading || selectedTitleId === equippedTitleId) return;

    setTitleBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/profile/titles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId: selectedTitleId || null }),
      });
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "Não foi possível equipar o título.");
      }

      setEquippedTitleId(selectedTitleId);
      setOwnedTitles((current) =>
        current.map((title) => ({
          ...title,
          equipped: title.id === selectedTitleId,
        })),
      );
      setFeedback({
        kind: "success",
        message: selectedTitleId ? "Título equipado." : "Título removido.",
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível equipar o título.",
      });
    } finally {
      setTitleBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const payload: {
      displayName?: string;
      bio?: string | null;
      privacy?: EditablePrivacyUpdate;
    } = {};

    const normalizedDisplayName = displayName.trim();
    const normalizedBio = bio.trim() || null;
    if (normalizedDisplayName !== identity.displayName) {
      payload.displayName = normalizedDisplayName;
    }
    if (normalizedBio !== identity.bio) {
      payload.bio = normalizedBio;
    }

    const privacyUpdate: EditablePrivacyUpdate = {};
    if (presenceVisibility !== privacy.presenceVisibility) {
      privacyUpdate.presenceVisibility = presenceVisibility;
    }
    if (activityVisibility !== privacy.activityVisibility) {
      privacyUpdate.activityVisibility = activityVisibility;
    }
    if (historyVisibility !== privacy.historyVisibility) {
      privacyUpdate.historyVisibility = historyVisibility;
    }
    if (friendRequestPolicy !== privacy.friendRequestPolicy) {
      privacyUpdate.friendRequestPolicy = friendRequestPolicy;
    }
    if (Object.keys(privacyUpdate).length > 0) {
      payload.privacy = privacyUpdate;
    }

    if (Object.keys(payload).length === 0) {
      setFeedback({ kind: "success", message: "Nenhuma alteração pendente." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "Não foi possível atualizar o Dossiê.");
      }

      setFeedback({ kind: "success", message: "Dossiê atualizado." });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o Dossiê.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={styles.trigger} onClick={openPanel}>
        Ajustar Dossiê
      </button>

      {open ? (
        <>
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Fechar configurações do Dossiê"
            onClick={() => {
              if (!locked) setOpen(false);
            }}
          />
          <section
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-settings-title"
          >
            <header className={styles.header}>
              <span>
                <small>Arquivo pessoal · @{identity.handle}</small>
                <strong id="profile-settings-title">Ajustar Dossiê</strong>
              </span>
              <button
                type="button"
                className={styles.close}
                aria-label="Fechar configurações"
                disabled={locked}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <form className={styles.form} onSubmit={submit}>
              <section className={styles.section} aria-labelledby="profile-identity-settings">
                <strong className={styles.sectionTitle} id="profile-identity-settings">
                  Identidade pública
                </strong>
                <label className={styles.field}>
                  <span>Nome de comando</span>
                  <input
                    value={displayName}
                    maxLength={48}
                    required
                    autoComplete="nickname"
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Handle permanente</span>
                  <input value={`@${identity.handle}`} disabled readOnly />
                </label>
                <label className={styles.field}>
                  <span>Biografia</span>
                  <textarea
                    value={bio}
                    maxLength={240}
                    placeholder="Registre uma breve descrição pública do comandante."
                    onChange={(event) => setBio(event.target.value)}
                  />
                </label>
              </section>

              <section className={styles.section} aria-labelledby="profile-title-settings">
                <strong className={styles.sectionTitle} id="profile-title-settings">
                  Título cosmético
                </strong>
                <label className={styles.field}>
                  <span>Título em exibição</span>
                  <select
                    value={selectedTitleId}
                    disabled={titlesLoading || titleBusy}
                    onChange={(event) => setSelectedTitleId(event.target.value)}
                  >
                    <option value="">Sem título</option>
                    {ownedTitles.map((title) => (
                      <option
                        key={title.id}
                        value={title.id}
                        disabled={!title.isActive && !title.equipped}
                      >
                        {title.name} · {title.rarity}
                        {!title.isActive ? " · indisponível" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <p className={styles.hint}>
                  {titlesLoading
                    ? "Sincronizando títulos desbloqueados..."
                    : ownedTitles.length === 0
                      ? "Nenhum título cosmético desbloqueado nesta conta."
                      : "Somente títulos desbloqueados e ativos podem ser equipados."}
                </p>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  disabled={
                    titlesLoading || titleBusy || selectedTitleId === equippedTitleId
                  }
                  onClick={() => void equipTitle()}
                >
                  {titleBusy ? "Equipando..." : "Aplicar título"}
                </button>
              </section>

              <section className={styles.section} aria-labelledby="profile-privacy-settings">
                <strong className={styles.sectionTitle} id="profile-privacy-settings">
                  Regras de exposição
                </strong>
                <label className={styles.field}>
                  <span>Presença</span>
                  <select
                    value={presenceVisibility}
                    onChange={(event) =>
                      setPresenceVisibility(event.target.value as ProfileVisibility)
                    }
                  >
                    {VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Atividade</span>
                  <select
                    value={activityVisibility}
                    onChange={(event) =>
                      setActivityVisibility(event.target.value as ProfileVisibility)
                    }
                  >
                    {VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Histórico de campanha</span>
                  <select
                    value={historyVisibility}
                    onChange={(event) =>
                      setHistoryVisibility(event.target.value as ProfileVisibility)
                    }
                  >
                    {VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Solicitações de aliança</span>
                  <select
                    value={friendRequestPolicy}
                    onChange={(event) =>
                      setFriendRequestPolicy(event.target.value as FriendRequestPolicy)
                    }
                  >
                    {REQUEST_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <footer className={styles.footer}>
                {feedback ? (
                  <p
                    className={styles.feedback}
                    data-kind={feedback.kind}
                    role={feedback.kind === "error" ? "alert" : "status"}
                  >
                    {feedback.message}
                  </p>
                ) : null}
                <button className={styles.submit} type="submit" disabled={busy}>
                  {busy ? "Sincronizando..." : "Salvar alterações"}
                </button>
              </footer>
            </form>
          </section>
        </>
      ) : null}
    </>
  );
}
