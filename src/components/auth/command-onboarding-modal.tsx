"use client";

import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import styles from "./command-onboarding-modal.module.css";

type CommandOnboardingModalProps = {
  initialDisplayName?: string | null;
  initialHandle?: string | null;
  onClose: () => void;
  onCompleted: () => void;
};

type CommanderSaveResponse = {
  ok?: boolean;
  message?: string;
  errors?: {
    handle?: string;
    displayName?: string;
  };
};

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function CommandOnboardingModal({
  initialDisplayName = "",
  initialHandle = "",
  onClose,
  onCompleted,
}: CommandOnboardingModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [errors, setErrors] = useState<CommanderSaveResponse["errors"]>({});
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setErrors({});
    setMessage("");

    startTransition(async () => {
      const response = await fetch("/api/auth/command-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: formText(formData, "displayName"),
          handle: formText(formData, "handle"),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as CommanderSaveResponse;

      if (!response.ok || !payload.ok) {
        setErrors(payload.errors ?? {});
        setMessage(
          payload.message ?? "Revise sua identidade de comando e tente novamente.",
        );
        return;
      }

      onCompleted();
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="commander-onboarding-title"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (!isPending) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && !isPending) onClose();
      }}
    >
      <section className={styles.shell}>
        <div className={styles.visual} aria-hidden="true">
          <span className={styles.protocol}>PROTOCOLO // ID-01</span>
          <div className={styles.insignia}>WB</div>
          <div>
            <strong>REGISTRO DE COMANDANTE</strong>
            <p>Sua conta já foi autenticada. Falta definir a identidade pública usada no teatro operacional.</p>
          </div>
        </div>

        <div className={styles.formPanel}>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            disabled={isPending}
            aria-label="Fechar registro de comandante"
          >
            ×
          </button>

          <header>
            <span className={styles.eyebrow}>IDENTIDADE PÚBLICA</span>
            <h2 id="commander-onboarding-title">Definir comandante</h2>
            <p>Escolha como os outros jogadores identificarão você. Email e credenciais permanecem privados.</p>
          </header>

          {message ? <div className={styles.message} role="status">{message}</div> : null}

          <form className={styles.form} onSubmit={submit}>
            <label>
              <span>Nome de exibição</span>
              <input
                autoFocus
                name="displayName"
                type="text"
                autoComplete="nickname"
                minLength={2}
                maxLength={48}
                defaultValue={initialDisplayName ?? ""}
                disabled={isPending}
                aria-invalid={Boolean(errors?.displayName)}
                required
              />
              {errors?.displayName ? <small className={styles.error}>{errors.displayName}</small> : null}
            </label>

            <label>
              <span>Identificador de comando</span>
              <div className={styles.handleField}>
                <span aria-hidden="true">@</span>
                <input
                  name="handle"
                  type="text"
                  autoComplete="off"
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9._-]+"
                  defaultValue={initialHandle ?? ""}
                  disabled={isPending}
                  aria-invalid={Boolean(errors?.handle)}
                  required
                />
              </div>
              {errors?.handle ? (
                <small className={styles.error}>{errors.handle}</small>
              ) : (
                <small>3–32 caracteres: letras, números, ponto, hífen ou sublinhado.</small>
              )}
            </label>

            <button className={styles.primary} disabled={isPending}>
              {isPending ? "REGISTRANDO..." : "CONCLUIR REGISTRO"}
            </button>
          </form>
        </div>
      </section>
    </dialog>
  );
}
