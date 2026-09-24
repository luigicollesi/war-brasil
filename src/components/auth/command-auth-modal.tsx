"use client";

import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { authClient } from "@/client/auth-client";
import {
  AUTH_CAPTCHA_ACTIONS,
  AUTH_CAPTCHA_RESPONSE_HEADER,
} from "@/src/lib/shared/auth-captcha";
import { TurnstileChallenge } from "./turnstile-challenge";
import styles from "./command-auth-modal.module.css";

export type CommandAuthMode =
  | "login"
  | "register"
  | "verification"
  | "forgot"
  | "reset";

type AuthProvider = "google" | "discord";

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
  retryAfterSeconds?: number;
};

type VerificationResponse = RegisterResponse & {
  authenticated?: boolean;
  next?: "onboarding";
};

const RESEND_COOLDOWN_SECONDS = 60;
const AUTH_REQUEST_TIMEOUT_MS = 15_000;

type PendingAction =
  | "social"
  | "login"
  | "register"
  | "resend"
  | "verify"
  | "forgot"
  | "reset";

async function fetchJsonWithTimeout<T>(
  input: string,
  init: RequestInit,
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as T;
    return { response, payload };
  } finally {
    window.clearTimeout(timeout);
  }
}

function authRequestFailureMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "A resposta do servidor demorou demais. Tente novamente.";
  }
  return "Não foi possível concluir a solicitação agora.";
}

const PROVIDERS: Array<{ id: AuthProvider; label: string; mark: string }> = [
  { id: "google", label: "Continuar com Google", mark: "G" },
  { id: "discord", label: "Continuar com Discord", mark: "D" },
];

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function maskEmailAddress(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) return value;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
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
  const [resendSecondsRemaining, setResendSecondsRemaining] = useState(0);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const isPending = pendingAction !== null;
  const resendTimerActive = resendSecondsRemaining > 0;

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaError("");
    setCaptchaResetKey((current) => current + 1);
  }, []);

  const handleCaptchaTokenChange = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, []);

  const handleCaptchaError = useCallback((nextMessage: string) => {
    setCaptchaError(nextMessage);
  }, []);

  const requireCaptchaToken = () => {
    if (captchaToken) return captchaToken;
    setCaptchaError("Confirme a verificação de segurança para continuar.");
    return null;
  };

  const runPendingAction = async (
    action: PendingAction,
    task: () => Promise<void>,
  ) => {
    if (pendingAction !== null) return;

    setPendingAction(action);
    try {
      await task();
    } catch (error) {
      console.error("[auth-ui] request failed", {
        action,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "UnknownError" },
      });
      setMessage(authRequestFailureMessage(error));
    } finally {
      setPendingAction(null);
    }
  };

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
      resetCaptcha();

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
  }, [initialMode, notice, open, resetCaptcha]);

  useEffect(() => {
    if (!resendTimerActive) {
      return;
    }

    const cooldown = window.setInterval(() => {
      setResendSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => window.clearInterval(cooldown);
  }, [resendTimerActive]);

  const close = () => {
    if (!isPending) {
      onClose();
    }
  };

  const changeMode = (nextMode: CommandAuthMode) => {
    setMode(nextMode);
    setMessage("");
    setFieldErrors({});
    resetCaptcha();
  };

  const signInWithProvider = (provider: AuthProvider) => {
    setMessage("");
    setFieldErrors({});

    void runPendingAction("social", async () => {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: "/home",
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

    const token = requireCaptchaToken();
    if (!token) return;

    void runPendingAction("login", async () => {
      try {
        const { error } = await authClient.signIn.email({
          email: nextEmail,
          password,
          rememberMe: true,
          fetchOptions: {
            headers: {
              [AUTH_CAPTCHA_RESPONSE_HEADER]: token,
            },
          },
        });

        if (error) {
          if (error.status === 422 || error.status === 503) {
            setCaptchaError(
              error.status === 503
                ? "A verificação de segurança está indisponível no momento."
                : "A verificação de segurança expirou ou não pôde ser confirmada.",
            );
            return;
          }
        if (error.status === 403) {
          setMode("verification");
          setMessage(
            "Confirme seu email antes de entrar. Você pode solicitar um novo código abaixo.",
          );
          return;
        }
        if (error.status === 429) {
          setMessage("Muitas tentativas. Aguarde antes de tentar entrar novamente.");
          return;
        }

          setMessage("Confira o email e a senha informados.");
          return;
        }

        await onAuthenticated();
      } finally {
        resetCaptcha();
      }
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

    const token = requireCaptchaToken();
    if (!token) return;

    void runPendingAction("register", async () => {
      try {
        const { response, payload } = await fetchJsonWithTimeout<RegisterResponse>(
          "/api/auth/register",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              [AUTH_CAPTCHA_RESPONSE_HEADER]: token,
            },
            body: JSON.stringify({
              email: nextEmail,
              password,
              termsAccepted,
            }),
          },
        );

        if (!response.ok || !payload.ok) {
          setFieldErrors(payload.errors ?? {});
          setMessage(
            payload.message ?? "Revise os campos destacados e tente novamente.",
          );
          return;
        }

        setResendSecondsRemaining(
          payload.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS,
        );
        setMode("verification");
        setMessage(
          payload.message ?? "Confira seu email para obter o código de confirmação.",
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setResendSecondsRemaining(RESEND_COOLDOWN_SECONDS);
          setMode("verification");
          setMessage(
            "O envio foi iniciado, mas a resposta demorou. Se você recebeu o código, digite-o abaixo.",
          );
          return;
        }
        throw error;
      } finally {
        resetCaptcha();
      }
    });
  };

  const resendVerification = () => {
    if (!email) {
      changeMode("register");
      return;
    }
    if (resendSecondsRemaining > 0) {
      return;
    }

    setMessage("");
    const token = requireCaptchaToken();
    if (!token) return;

    void runPendingAction("resend", async () => {
      try {
        const { response, payload } = await fetchJsonWithTimeout<RegisterResponse>(
          "/api/auth/register/resend",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              [AUTH_CAPTCHA_RESPONSE_HEADER]: token,
            },
            body: JSON.stringify({ email }),
          },
        );

        if (!response.ok || !payload.ok) {
          if (response.status === 422 || response.status === 503) {
            setCaptchaError(
              payload.message ??
                "Não foi possível confirmar a verificação de segurança.",
            );
            return;
          }
        setMessage(
          payload.message ?? "Não foi possível solicitar um novo código agora.",
        );
        return;
      }

      setResendSecondsRemaining(
        payload.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS,
      );
        setMessage(
          payload.message ??
            "Se existir um cadastro pendente para esse endereço, enviaremos um novo código.",
        );
      } finally {
        resetCaptcha();
      }
    });
  };

  const submitVerification = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const code = readFormValue(formData, "code").replace(/\D/g, "").slice(0, 6);

    setMessage("");
    setFieldErrors({});

    if (!email) {
      setMode("register");
      setMessage("Informe novamente seu email para iniciar o cadastro.");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setFieldErrors({ code: "Digite os 6 dígitos enviados para seu email." });
      return;
    }

    void runPendingAction("verify", async () => {
      const { response, payload } = await fetchJsonWithTimeout<VerificationResponse>(
        "/api/auth/register/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        },
      );

      if (!response.ok || !payload.ok || !payload.authenticated) {
        setMessage(
          payload.message ?? "Não foi possível confirmar este código agora.",
        );
        return;
      }

      await onAuthenticated();
    });
  };

  const submitForgotPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextEmail = readFormValue(formData, "email").trim();

    setEmail(nextEmail);
    setMessage("");

    const token = requireCaptchaToken();
    if (!token) return;

    void runPendingAction("forgot", async () => {
      try {
        const { error } = await authClient.requestPasswordReset({
          email: nextEmail,
          redirectTo: "/?auth=reset-password",
          fetchOptions: {
            headers: {
              [AUTH_CAPTCHA_RESPONSE_HEADER]: token,
            },
          },
        });

        if (error?.status === 422 || error?.status === 503) {
          setCaptchaError(
            error.status === 503
              ? "A verificação de segurança está indisponível no momento."
              : "A verificação de segurança expirou ou não pôde ser confirmada.",
          );
          return;
        }

        setMessage(
          error?.status === 429
            ? "Limite de solicitações atingido. Aguarde antes de tentar novamente."
            : "Se existir uma conta para esse endereço, enviaremos as instruções de redefinição.",
        );
      } finally {
        resetCaptcha();
      }
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

    void runPendingAction("reset", async () => {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token: resetToken,
      });

      if (error) {
        setMessage("Este link não pôde ser usado. Solicite uma nova redefinição.");
        return;
      }

      await authClient.signOut();
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
                ? "Digite o código de 6 dígitos enviado para seu email. A conta só será criada depois da confirmação."
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
              <TurnstileChallenge
                action={AUTH_CAPTCHA_ACTIONS.login}
                resetKey={captchaResetKey}
                onTokenChange={handleCaptchaTokenChange}
                onError={handleCaptchaError}
              />
              {captchaError ? (
                <small className={styles.captchaError} role="alert">
                  {captchaError}
                </small>
              ) : null}
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
              <button
                className={styles.primaryButton}
                disabled={isPending || !captchaToken}
              >
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
                  Aceito os{" "}
                  <Link href="/terms" target="_blank">
                    Termos de Uso
                  </Link>{" "}
                  e a{" "}
                  <Link href="/privacy" target="_blank">
                    Política de Privacidade
                  </Link>{" "}
                  do Bellum Civile.
                </span>
              </label>
              {fieldErrors.termsAccepted ? (
                <small className={styles.fieldError}>{fieldErrors.termsAccepted}</small>
              ) : null}
              <TurnstileChallenge
                action={AUTH_CAPTCHA_ACTIONS.register}
                resetKey={captchaResetKey}
                onTokenChange={handleCaptchaTokenChange}
                onError={handleCaptchaError}
              />
              {captchaError ? (
                <small className={styles.captchaError} role="alert">
                  {captchaError}
                </small>
              ) : null}
              <button
                className={styles.primaryButton}
                disabled={isPending || !captchaToken}
              >
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
                #
              </div>
              <p>
                {email
                  ? `Enviamos um código para ${maskEmailAddress(email)}.`
                  : "Informe novamente seu email para receber um código de confirmação."}
              </p>
              <p className={styles.muted}>O código é válido por 10 minutos.</p>

              <form className={styles.form} onSubmit={submitVerification}>
                <label>
                  <span>Código de confirmação</span>
                  <input
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    placeholder="000000"
                    disabled={isPending}
                    aria-invalid={Boolean(fieldErrors.code)}
                    required
                  />
                  {fieldErrors.code ? (
                    <small className={styles.fieldError}>{fieldErrors.code}</small>
                  ) : (
                    <small>Digite os 6 dígitos recebidos por email.</small>
                  )}
                </label>

                <button className={styles.primaryButton} disabled={isPending}>
                  {isPending ? "CONFIRMANDO..." : "CONFIRMAR EMAIL"}
                </button>
              </form>

              <TurnstileChallenge
                action={AUTH_CAPTCHA_ACTIONS.resendRegistration}
                resetKey={captchaResetKey}
                onTokenChange={handleCaptchaTokenChange}
                onError={handleCaptchaError}
              />
              {captchaError ? (
                <small className={styles.captchaError} role="alert">
                  {captchaError}
                </small>
              ) : null}
              <button
                type="button"
                className={styles.primaryButton}
                onClick={resendVerification}
                disabled={
                  isPending || resendSecondsRemaining > 0 || !captchaToken
                }
              >
                {isPending
                  ? "SOLICITANDO..."
                  : resendSecondsRemaining > 0
                    ? `NOVO CÓDIGO EM ${resendSecondsRemaining} S`
                    : "REENVIAR CÓDIGO"}
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
              <TurnstileChallenge
                action={AUTH_CAPTCHA_ACTIONS.forgotPassword}
                resetKey={captchaResetKey}
                onTokenChange={handleCaptchaTokenChange}
                onError={handleCaptchaError}
              />
              {captchaError ? (
                <small className={styles.captchaError} role="alert">
                  {captchaError}
                </small>
              ) : null}
              <button
                className={styles.primaryButton}
                disabled={isPending || !captchaToken}
              >
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
