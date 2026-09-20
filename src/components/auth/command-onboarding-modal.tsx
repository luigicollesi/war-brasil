"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import styles from "./command-onboarding-modal.module.css";

type OnboardingStage = "birth-date" | "identity" | "blocked";

type CommandOnboardingModalProps = {
  initialDisplayName?: string | null;
  initialHandle?: string | null;
  ageGateComplete: boolean;
  identityComplete: boolean;
  onClose: () => void;
  onCompleted: () => void;
  onAccountDeleted: () => void | Promise<void>;
};

type CommanderSaveResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  accountDeleted?: boolean;
  errors?: {
    handle?: string;
    displayName?: string;
    birthDate?: string;
  };
};

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function CommandOnboardingModal({
  initialDisplayName = "",
  initialHandle = "",
  ageGateComplete,
  identityComplete,
  onClose,
  onCompleted,
  onAccountDeleted,
}: CommandOnboardingModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [stage, setStage] = useState<OnboardingStage>(
    ageGateComplete ? "identity" : "birth-date",
  );
  const [errors, setErrors] = useState<CommanderSaveResponse["errors"]>({});
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

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

  const submitBirthDate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setErrors({});
    setMessage("");

    startTransition(async () => {
      const response = await fetch("/api/auth/command-access/age", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birthDate: formText(formData, "birthDate"),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as CommanderSaveResponse;

      if (
        response.status === 403 &&
        payload.code === "minimum_age_not_met" &&
        payload.accountDeleted
      ) {
        setStage("blocked");
        setMessage(
          payload.message ??
            "Você ainda não tem idade para jogar Bellum Civile. Sua conta foi excluída.",
        );
        return;
      }

      if (!response.ok || !payload.ok) {
        setErrors(payload.errors ?? {});
        setMessage(
          payload.message ?? "Não foi possível verificar sua idade agora.",
        );
        return;
      }

      if (identityComplete) {
        onCompleted();
        return;
      }

      setStage("identity");
    });
  };

  const submitIdentity = (event: FormEvent<HTMLFormElement>) => {
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
        if (!isPending && stage !== "blocked") onClose();
      }}
      onClick={(event) => {
        if (
          event.target === dialogRef.current &&
          !isPending &&
          stage !== "blocked"
        ) {
          onClose();
        }
      }}
    >
      <section className={styles.shell}>
        <div className={styles.visual} aria-hidden="true">
          <span className={styles.protocol}>
            {stage === "birth-date" ? "PROTOCOLO // IDADE-01" : "PROTOCOLO // ID-01"}
          </span>
          <div className={styles.insignia}>BC</div>
          <div>
            <strong>
              {stage === "birth-date"
                ? "VERIFICAÇÃO DE ACESSO"
                : stage === "blocked"
                  ? "ACESSO ENCERRADO"
                  : "REGISTRO DE COMANDANTE"}
            </strong>
            <p>
              {stage === "birth-date"
                ? "Antes da identidade pública, confirmamos o requisito mínimo de idade."
                : stage === "blocked"
                  ? "O requisito mínimo de idade não foi atendido."
                  : "Sua conta já foi autenticada. Falta definir a identidade pública usada no teatro operacional."}
            </p>
          </div>
        </div>

        <div className={styles.formPanel}>
          {stage !== "blocked" ? (
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              disabled={isPending}
              aria-label="Fechar registro de comandante"
            >
              ×
            </button>
          ) : null}

          {stage === "birth-date" ? (
            <>
              <header>
                <span className={styles.eyebrow}>VERIFICAÇÃO DE IDADE</span>
                <h2 id="commander-onboarding-title">Antes do comandante</h2>
                <p>
                  Informe sua data de nascimento. Ela é privada e usada para
                  verificar se você atende à idade mínima do jogo.
                </p>
              </header>

              {message ? <div className={styles.message} role="status">{message}</div> : null}

              <form className={styles.form} onSubmit={submitBirthDate}>
                <label>
                  <span>Data de nascimento</span>
                  <input
                    autoFocus
                    name="birthDate"
                    type="date"
                    autoComplete="bday"
                    max={today}
                    disabled={isPending}
                    aria-invalid={Boolean(errors?.birthDate)}
                    required
                  />
                  {errors?.birthDate ? (
                    <small className={styles.error}>{errors.birthDate}</small>
                  ) : (
                    <small>Bellum Civile é destinado a jogadores com 10 anos ou mais.</small>
                  )}
                </label>

                <p className={styles.legalNote}>
                  Ao continuar, você confirma que a data informada é verdadeira.
                  Consulte os <Link href="/terms" target="_blank">Termos de Uso</Link> e a{" "}
                  <Link href="/privacy" target="_blank">Política de Privacidade</Link>.
                </p>

                <button className={styles.primary} disabled={isPending}>
                  {isPending ? "VERIFICANDO..." : "VERIFICAR IDADE"}
                </button>
              </form>
            </>
          ) : null}

          {stage === "identity" ? (
            <>
              <header>
                <span className={styles.eyebrow}>IDENTIDADE PÚBLICA</span>
                <h2 id="commander-onboarding-title">Definir comandante</h2>
                <p>
                  Escolha como os outros jogadores identificarão você. Email,
                  credenciais e data de nascimento permanecem privados.
                </p>
              </header>

              {message ? <div className={styles.message} role="status">{message}</div> : null}

              <form className={styles.form} onSubmit={submitIdentity}>
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
            </>
          ) : null}

          {stage === "blocked" ? (
            <section className={styles.blocked} aria-live="polite">
              <span className={styles.eyebrow}>IDADE MÍNIMA NÃO ATENDIDA</span>
              <h2 id="commander-onboarding-title">Acesso indisponível</h2>
              <p>{message}</p>
              <p>
                O jogo exige pelo menos 10 anos de idade. Nenhuma identidade de
                comandante foi criada.
              </p>
              <button
                type="button"
                className={styles.primary}
                onClick={() => void onAccountDeleted()}
              >
                VOLTAR À HOME
              </button>
            </section>
          ) : null}
        </div>
      </section>
    </dialog>
  );
}
