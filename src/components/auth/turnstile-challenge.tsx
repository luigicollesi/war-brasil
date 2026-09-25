"use client";

import { useEffect, useRef } from "react";
import {
  AUTH_CAPTCHA_ACTIONS,
  type AuthCaptchaAction,
} from "@/src/lib/shared/auth-captcha";
import styles from "./command-auth-modal.module.css";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-api";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

type TurnstileWidgetId = string;

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: AuthCaptchaAction;
      theme: "dark";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
      "error-callback": () => void;
    },
  ): TurnstileWidgetId;
  remove(widgetId: TurnstileWidgetId): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(
      TURNSTILE_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    const ready = () => {
      if (window.turnstile) {
        resolve();
      } else {
        reject(new Error("Turnstile carregou sem expor a API."));
      }
    };

    if (existing) {
      existing.addEventListener("load", ready, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Falha ao carregar Turnstile.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", ready, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Falha ao carregar Turnstile.")),
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error) => {
    turnstileScriptPromise = null;
    throw error;
  });

  return turnstileScriptPromise;
}

type TurnstileChallengeProps = {
  action: AuthCaptchaAction;
  resetKey: number;
  onError: (message: string) => void;
  onTokenChange: (token: string | null) => void;
};

export function TurnstileChallenge({
  action,
  resetKey,
  onError,
  onTokenChange,
}: TurnstileChallengeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let widgetId: TurnstileWidgetId | null = null;

    onTokenChange(null);

    if (!TURNSTILE_SITE_KEY) {
      onError("A verificação de segurança não está configurada.");
      return;
    }

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;

        containerRef.current.replaceChildren();
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: "dark",
          callback: (token) => {
            if (!cancelled) {
              onError("");
              onTokenChange(token);
            }
          },
          "expired-callback": () => {
            if (!cancelled) {
              onTokenChange(null);
              onError(
                "A verificação expirou. Confirme novamente para continuar.",
              );
            }
          },
          "timeout-callback": () => {
            if (!cancelled) {
              onTokenChange(null);
              onError(
                "A verificação expirou. Confirme novamente para continuar.",
              );
            }
          },
          "error-callback": () => {
            if (!cancelled) {
              onTokenChange(null);
              onError(
                "Não foi possível concluir a verificação de segurança.",
              );
            }
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          onTokenChange(null);
          onError("Não foi possível carregar a verificação de segurança.");
        }
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [action, onError, onTokenChange, resetKey]);

  return (
    <div className={styles.captchaBlock}>
      <div ref={containerRef} className={styles.captchaWidget} />
    </div>
  );
}

export { AUTH_CAPTCHA_ACTIONS };
