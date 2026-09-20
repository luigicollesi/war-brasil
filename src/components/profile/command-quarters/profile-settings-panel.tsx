"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ProfileTitleRenderer } from "@/src/components/profile/profile-title-renderer";
import type {
  CommanderIdentity,
  FriendRequestPolicy,
  ProfilePrivacySettings,
  ProfileVisibility,
} from "@/src/lib/profile/profile-command-contract";
import type {
  CommanderBackgroundAppearance,
  CommanderTitleAppearance,
  ProfileAppearanceSnapshot,
} from "@/src/lib/profile/profile-appearance-contract";
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

type AppearanceView = "root" | "titles" | "backgrounds";

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
  const [appearanceBusy, setAppearanceBusy] = useState(false);
  const [appearanceLoading, setAppearanceLoading] = useState(false);
  const [appearanceView, setAppearanceView] = useState<AppearanceView>("root");
  const [appearance, setAppearance] = useState<ProfileAppearanceSnapshot | null>(null);
  const [selectedTitleId, setSelectedTitleId] = useState<string | null>(null);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
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

  const locked = busy || appearanceBusy;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !locked) {
        if (appearanceView !== "root") {
          setAppearanceView("root");
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appearanceView, locked, open]);

  const selectedTitle = useMemo(
    () =>
      appearance?.titles.find((title) => title.id === selectedTitleId) ?? null,
    [appearance, selectedTitleId],
  );

  const selectedBackground = useMemo(
    () =>
      appearance?.backgrounds.find(
        (background) => background.id === selectedBackgroundId,
      ) ?? null,
    [appearance, selectedBackgroundId],
  );

  async function loadAppearance() {
    setAppearanceLoading(true);
    try {
      const response = await fetch("/api/profile/appearance", {
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | (ProfileAppearanceSnapshot & { message?: string })
        | { message?: string }
        | null;

      if (
        !response.ok ||
        !body ||
        !("titles" in body) ||
        !Array.isArray(body.titles) ||
        !Array.isArray(body.backgrounds)
      ) {
        throw new Error(body?.message ?? "Não foi possível carregar a aparência.");
      }

      setAppearance(body);
      setSelectedTitleId(body.equippedTitleId);
      setSelectedBackgroundId(body.equippedBackgroundId);
    } catch (error) {
      setAppearance(null);
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a aparência.",
      });
    } finally {
      setAppearanceLoading(false);
    }
  }

  function openPanel() {
    setDisplayName(identity.displayName);
    setBio(identity.bio ?? "");
    setPresenceVisibility(privacy.presenceVisibility);
    setActivityVisibility(privacy.activityVisibility);
    setHistoryVisibility(privacy.historyVisibility);
    setFriendRequestPolicy(privacy.friendRequestPolicy);
    setAppearanceView("root");
    setFeedback(null);
    setOpen(true);
    void loadAppearance();
  }

  async function applyAppearance() {
    if (!appearance || appearanceBusy) return;

    const titleChanged = selectedTitleId !== appearance.equippedTitleId;
    const backgroundChanged =
      selectedBackgroundId !== appearance.equippedBackgroundId;

    if (!titleChanged && !backgroundChanged) {
      setAppearanceView("root");
      return;
    }

    const payload: { titleId?: string | null; backgroundId?: string } = {};
    if (titleChanged) payload.titleId = selectedTitleId;
    if (backgroundChanged) payload.backgroundId = selectedBackgroundId;

    setAppearanceBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/profile/appearance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "Não foi possível aplicar a aparência.");
      }

      setAppearance({
        ...appearance,
        equippedTitleId: selectedTitleId,
        equippedBackgroundId: selectedBackgroundId,
        titles: appearance.titles.map((title) => ({
          ...title,
          equipped: title.id === selectedTitleId,
        })),
        backgrounds: appearance.backgrounds.map((background) => ({
          ...background,
          equipped: background.id === selectedBackgroundId,
        })),
      });
      setAppearanceView("root");
      setFeedback({ kind: "success", message: "Aparência atualizada." });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível aplicar a aparência.",
      });
    } finally {
      setAppearanceBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
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
  }

  function titleOption(title: CommanderTitleAppearance) {
    return (
      <button
        key={title.id}
        type="button"
        className={styles.titleOption}
        data-selected={selectedTitleId === title.id ? "true" : "false"}
        disabled={!title.isActive && !title.equipped}
        onClick={() => setSelectedTitleId(title.id)}
      >
        <ProfileTitleRenderer title={title} className={styles.titlePreview} />
        <span>
          <small>{title.rarity}</small>
          <em>{selectedTitleId === title.id ? "SELECIONADO" : "USAR TÍTULO"}</em>
        </span>
      </button>
    );
  }

  function backgroundOption(background: CommanderBackgroundAppearance) {
    return (
      <button
        key={background.id}
        type="button"
        className={styles.backgroundOption}
        data-selected={selectedBackgroundId === background.id ? "true" : "false"}
        disabled={!background.isActive && !background.equipped}
        onClick={() => setSelectedBackgroundId(background.id)}
      >
        <span
          className={styles.backgroundPreview}
          style={{
            backgroundImage: `url("${
              background.previewRef ?? background.assetRef
            }")`,
          }}
          aria-hidden="true"
        />
        <span className={styles.backgroundCopy}>
          <strong>{background.name}</strong>
          <small>{background.rarity}</small>
        </span>
      </button>
    );
  }

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
                <strong id="profile-settings-title">
                  {appearanceView === "root"
                    ? "Ajustar Dossiê"
                    : appearanceView === "titles"
                      ? "Escolher título"
                      : "Profile Background"}
                </strong>
              </span>
              <button
                type="button"
                className={styles.close}
                aria-label={
                  appearanceView === "root"
                    ? "Fechar configurações"
                    : "Voltar para Ajustar Dossiê"
                }
                disabled={locked}
                onClick={() =>
                  appearanceView === "root"
                    ? setOpen(false)
                    : setAppearanceView("root")
                }
              >
                {appearanceView === "root" ? "×" : "←"}
              </button>
            </header>

            {appearanceView === "titles" ? (
              <div className={styles.appearanceScreen}>
                <button
                  type="button"
                  className={styles.titleOption}
                  data-selected={selectedTitleId === null ? "true" : "false"}
                  onClick={() => setSelectedTitleId(null)}
                >
                  <strong className={styles.noTitle}>SEM TÍTULO</strong>
                  <span>
                    <small>padrão</small>
                    <em>{selectedTitleId === null ? "SELECIONADO" : "USAR"}</em>
                  </span>
                </button>
                {appearance?.titles.map(titleOption)}
                <button
                  type="button"
                  className={styles.applyAppearance}
                  disabled={appearanceBusy || appearanceLoading}
                  onClick={() => void applyAppearance()}
                >
                  {appearanceBusy ? "APLICANDO..." : "APLICAR TÍTULO"}
                </button>
              </div>
            ) : appearanceView === "backgrounds" ? (
              <div className={styles.appearanceScreen}>
                <div className={styles.backgroundGrid}>
                  {appearance?.backgrounds.map(backgroundOption)}
                </div>
                <button
                  type="button"
                  className={styles.applyAppearance}
                  disabled={
                    appearanceBusy ||
                    appearanceLoading ||
                    !selectedBackgroundId
                  }
                  onClick={() => void applyAppearance()}
                >
                  {appearanceBusy ? "APLICANDO..." : "APLICAR BACKGROUND"}
                </button>
              </div>
            ) : (
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

                <section className={styles.section} aria-labelledby="profile-appearance-settings">
                  <strong className={styles.sectionTitle} id="profile-appearance-settings">
                    Aparência pública
                  </strong>

                  <button
                    type="button"
                    className={styles.appearanceEntry}
                    disabled={appearanceLoading}
                    onClick={() => setAppearanceView("titles")}
                  >
                    <span>
                      <small>TÍTULO</small>
                      <strong>
                        {selectedTitle?.displayText ?? "Sem título equipado"}
                      </strong>
                    </span>
                    <em>›</em>
                  </button>

                  <button
                    type="button"
                    className={styles.appearanceEntry}
                    disabled={appearanceLoading}
                    onClick={() => setAppearanceView("backgrounds")}
                  >
                    <span>
                      <small>PROFILE BACKGROUND</small>
                      <strong>
                        {selectedBackground?.name ??
                          (appearanceLoading ? "Carregando..." : "Indisponível")}
                      </strong>
                    </span>
                    <em>›</em>
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
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
