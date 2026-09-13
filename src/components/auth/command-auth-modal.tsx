"use client";

import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { authClient } from "@/client/auth-client";
import styles from "./command-auth-modal.module.css";

export type CommandAuthMode =
  | "login"
  | "register"
  | "verification"
  | "forgot"
  | "reset";

type AuthProvider = "google" | "apple" | "discord";

type CommandAuthModalProps = {
  initialMode?: CommandAuthMode;
  notice?: string;
  onAuthenticated: () => void | Promise<void>;
  onClose: () => void;
  open: boolean;
  resetToken?: string | null;
};

type RegisterResponse = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const PROVIDERS: Array<{ id: AuthProvider; label: string; mark: string }> = [
  { id: "google", label: "Continuar com Google", mark: "G" },
  { id: "apple", label: "Continuar com Apple", mark: "●" },
  { id: "discord", label: "Continuar com Discord", mark: "D" },
];

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function CommandAuthModal({
  initialMode = "login",
  notice = "",
  onAuthenticated,
  onClose,
  open,
  resetToken = null,
}: CommandAuthModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [mode, setMode] = useState<CommandAuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(notice);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const frame = window.requestAnimationFrame(() => {
      setMode(initialMode);
      setMessage(notice);
      setFieldErrors({});

      if (dialog && !dialog.open) {
        dialog.showModal();
      }
      document.body.style.overflow = "hidden";
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, [initialMode, notice, open]);

  const close = () => {
    if (!isPending) {
      onClose();
    }
  };

  const changeMode = (nextMode: CommandAuthMode) => {
    setMode(nextMode);
    setMessage("");
    setFieldErrors({});
  };

  const signInWithProvider = (provider: AuthProvider) => {
    setMessage("");
    setFieldErrors({});

    startTransition(async () => {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: "/?continue=command",
      });

      if (error) {
        setMessage("Não foi possível iniciar esse acesso externo agora.");
      }
    });
  };

  const submitLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextEmail = readFormValue(formData, "email").trim();
    const password = readFormValue(formData, "password");

    setEmail(nextEmail);
    setMessage("");
    setFieldErrors({});

    startTransition(async () => {
      const { error } = await authClient.signIn.email({
        email: nextEmail,
        password,
        rememberMe: true,
      });

      if (error) {
        if (error.status === 403) {
          setMode("verification");
          setMessage(
            "Confirme seu email antes de entrar. Você pode solicitar um novo link abaixo.",
          );
          return;
        }

        setMessage("Confira o email e a senha informados.");
        return;
      }

      await onAuthenticated();
    });
  };

  const submitRegister = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextEmail = readFormValue(formData, "email").trim();
    const password = readFormValue(formData, "password");
    const passwordConfirmation = readFormValue(formData, "passwordConfirmation");
    const termsAccepted = formData.get("termsAccepted") === "on";

    setEmail(nextEmail);
    setMessage("");
    setFieldErrors({});

    if (password !== passwordConfirmation) {
      setFieldErrors({ passwordConfirmation: "As senhas não coincidem." });
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: nextEmail,
          password,
          termsAccepted,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as RegisterResponse;

      if (!response.ok || !payload.ok) {
        setFieldErrors(payload.errors ?? {});
        setMessage(
          payload.message ?? "Revise os campos destacados e tente novamente.",
        );
        return;
      }

      setMode("verification");
      setMessage(payload.message ?? "Confira seu email para concluir o cadastro.");
    });
  };

  const resendVerification = () => {
    if (!email) {
      changeMode("login");
      return;
    }

    setMessage("");
    startTransition(async () => {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/?emailVerified=success&continue=command",
      });

      setMessage(
        error
          ? "Não foi possível solicitar outro link agora. Tente novamente em instantes."
          : "Se existir uma conta pendente para esse endereço, enviaremos um novo link.",
      );
    });
  };

  const submitForgotPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextEmail = readFormValue(formData, "email").trim();

    setEmail(nextEmail);
    setMessage("");

    startTransition(async () => {
      const { error } = await authClient.requestPasswordReset({
        email: nextEmail,
        redirectTo: "/?auth=reset-password",
      });

      setMessage(
        error
          ? "Não foi possível solicitar a redefinição agora."
          : "Se existir uma conta para esse endereço, enviaremos as instruções de redefinição.",
      );
    });
  };

  const submitResetPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = readFormValue(formData, "password");
    const passwordConfirmation = readFormValue(formData, "passwordConfirmation");

    setMessage("");
    setFieldErrors({});

    if (!resetToken) {
      setMessage("Este link de redefinição não é válido ou já expirou.");
      return;
    }
    if (password !== passwordConfirmation) {
      setFieldErrors({ passwordConfirmation: "As senhas não coincidem." });
      return;
    }

    startTransition(async () => {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token: resetToken,
      });

      if (error) {
        setMessage("Este link não pôde ser usado. Solicite uma nova redefinição.");
        return;
      }

      setMode("login");
      setMessage("Senha redefinida. Entre novamente para acessar o Comando.");
      window.history.replaceState({}, "", "/");
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="command-auth-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          close();
        }
      }}
    >
      <div className={styles.shell}>
        <aside className={styles.identityPanel} aria-hidden="true">
          <div className={styles.protocol}>PROTOCOLO // A-01</div>
          <div className={styles.orbitalMark}>
            <span className={styles.orbitOne} />
            <span className={styles.orbitTwo} />
            <span className={styles.orbCore}>WB</span>
          </div>
          <div>
            <strong>IDENTIDADE DE COMANDO</strong>
            <p>
              Uma credencial válida autoriza o acesso ao teatro operacional.
            </p>
          </div>
          <dl className={styles.securityReadout}>
            <div>
              <dt>SESSÃO</dt>
              <dd>CRIPTOGRAFADA</dd>
            </div>
            <div>
              <dt>CANAL</dt>
              <dd>VERIFICADO</dd>
            </div>
          </dl>
        </aside>

        <section className={styles.authPanel}>
          <button
            type="button"
            className={styles.closeButton}
            onClick={close}
            aria-label="Fechar autenticação"
            disabled={isPending}
          >
            ×
          </button>

          <header className={styles.header}>
            <span className={styles.eyebrow}>
              {mode === "register"
                ? "NOVO REGISTRO"
                : mode === "verification"
                  ? "VALIDAÇÃO PENDENTE"
                  : mode === "forgot" || mode === "reset"
                    ? "RECUPERAÇÃO"
                    : "ACESSO RESTRITO"}
            </span>
            <h2 id="command-auth-title">
              {mode === "register"
                ? "Registrar identidade"
                : mode === "verification"
                  ? "Confirme seu email"
                  : mode === "forgot"
                    ? "Recuperar acesso"
                    : mode === "reset"
                      ? "Definir nova senha"
                      : "Entrar no Comando"}
            </h2>
            <p>
              {mode === "verification"
                ? "O cadastro só é liberado depois que o endereço de email for confirmado."
                : mode === "reset"
                  ? "Escolha uma nova credencial para sua conta War-Brasil."
                  : "Use uma das credenciais autorizadas abaixo."}
            </p>
          </header>

          {message ? (
            <div className={styles.message} role="status">
              {message}
            </div>
          ) : null}

          {mode === "login" || mode === "register" ? (
            <>
              <div className={styles.providers}>
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    className={styles.providerButton}
                    onClick={() => signInWithProvider(provider.id)}
                    disabled={isPending}
                  >
                    <span className={styles.providerMark} aria-hidden="true">
                      {provider.mark}
                    </span>
                    <span>{provider.label}</span>
                  </button>
                ))}
              </div>

              <div className={styles.divider}>
                <span>OU CREDENCIAL DE EMAIL</span>
              </div>
            </>
          ) : null}

          {mode === "login" ? (
            <form className={styles.form} onSubmit={submitLogin}>
              <label>
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={email}
                  disabled={isPending}
                />
              </label>
              <label>
                <span>Senha</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={isPending}
                />
              </label>
              <div className={styles.formActionsRow}>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => changeMode("forgot")}
                  disabled={isPending}
                >
                  Esqueci minha senha
                </button>
              </div>
              <button className={styles.primaryButton} disabled={isPending}>
                {isPending ? "VALIDANDO..." : "AUTORIZAR ACESSO"}
              </button>
              <button
                type="button"
                className={styles.switchButton}
                onClick={() => changeMode("register")}
                disabled={isPending}
              >
                Ainda não possui registro? <strong>Criar conta</strong>
              </button>
            </form>
          ) : null}

          {mode === "register" ? (
            <form className={styles.form} onSubmit={submitRegister}>
              <label>
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isPending}
                  aria-invalid={Boolean(fieldErrors.email)}
                />
                {fieldErrors.email ? (
                  <small className={styles.fieldError}>{fieldErrors.email}</small>
                ) : null}
              </label>
              <label>
                <span>Senha</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={isPending}
                  aria-invalid={Boolean(fieldErrors.password)}
                />
                {fieldErrors.password ? (
                  <small className={styles.fieldError}>{fieldErrors.password}</small>
                ) : (
                  <small>8–128 caracteres.</small>
                )}
              </label>
              <label>
                <span>Confirmar senha</span>
                <input
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={isPending}
                  aria-invalid={Boolean(fieldErrors.passwordConfirmation)}
                />
                {fieldErrors.passwordConfirmation ? (
                  <small className={styles.fieldError}>
                    {fieldErrors.passwordConfirmation}
                  </small>
                ) : null}
              </label>
              <label className={styles.checkRow}>
                <input
                  name="termsAccepted"
                  type="checkbox"
                  disabled={isPending}
                  aria-invalid={Boolean(fieldErrors.termsAccepted)}
                />
                <span>
                  Aceito os termos de uso e a política de privacidade do War-Brasil.
                </span>
              </label>
              {fieldErrors.termsAccepted ? (
                <small className={styles.fieldError}>{fieldErrors.termsAccepted}</small>
              ) : null}
              <button className={styles.primaryButton} disabled={isPending}>
                {isPending ? "REGISTRANDO..." : "CRIAR REGISTRO"}
              </button>
              <button
                type="button"
                className={styles.switchButton}
                onClick={() => changeMode("login")}
                disabled={isPending}
              >
                Já possui registro? <strong>Entrar</strong>
              </button>
            </form>
          ) : null}

          {mode === "verification" ? (
            <div className={styles.verificationPanel}>
              <div className={styles.verificationSeal} aria-hidden="true">
                @
              </div>
              <p>
                {email
                  ? `Enviamos a confirmação para ${email}.`
                  : "Abra o link de confirmação enviado para o seu email."}
              </p>
              <p className={styles.muted}>O link é válido por 1 hora.</p>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={resendVerification}
                disabled={isPending}
              >
                {isPending ? "SOLICITANDO..." : "REENVIAR EMAIL"}
              </button>
              <button
                type="button"
                className={styles.switchButton}
                onClick={() => changeMode("login")}
                disabled={isPending}
              >
                Voltar para entrar
              </button>
            </div>
          ) : null}

          {mode === "forgot" ? (
            <form className={styles.form} onSubmit={submitForgotPassword}>
              <label>
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={email}
                  disabled={isPending}
                />
              </label>
              <button className={styles.primaryButton} disabled={isPending}>
                {isPending ? "SOLICITANDO..." : "ENVIAR REDEFINIÇÃO"}
              </button>
              <button
                type="button"
                className={styles.switchButton}
                onClick={() => changeMode("login")}
                disabled={isPending}
              >
                Voltar para entrar
              </button>
            </form>
          ) : null}

          {mode === "reset" ? (
            <form className={styles.form} onSubmit={submitResetPassword}>
              <label>
                <span>Nova senha</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={isPending}
                />
              </label>
              <label>
                <span>Confirmar nova senha</span>
                <input
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={isPending}
                  aria-invalid={Boolean(fieldErrors.passwordConfirmation)}
                />
                {fieldErrors.passwordConfirmation ? (
                  <small className={styles.fieldError}>
                    {fieldErrors.passwordConfirmation}
                  </small>
                ) : null}
              </label>
              <button className={styles.primaryButton} disabled={isPending}>
                {isPending ? "ATUALIZANDO..." : "DEFINIR NOVA SENHA"}
              </button>
            </form>
          ) : null}

          <footer className={styles.footer}>
            <span>BETTER AUTH // WAR-BRASIL</span>
            <span>CONEXÃO PROTEGIDA</span>
          </footer>
        </section>
      </div>
    </dialog>
  );
}
