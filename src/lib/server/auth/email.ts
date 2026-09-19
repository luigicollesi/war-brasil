import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { after } from "next/server";
import { readAuthServerEnvironment } from "./environment";

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
const EMAIL_DELIVERY_TIMEOUT_MS = 8_000;

export type AuthEmailMessage = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

type AuthEmailSinkMessage = AuthEmailMessage & {
  capturedAt: string;
};

type ResendAuthEmailTransport = {
  from: string;
  apiKey: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isNonDeliverableAuthAddress(value: string) {
  const normalized = value.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex < 0) return true;

  const domain = normalized.slice(atIndex + 1);
  return domain === "invalid" || domain.endsWith(".invalid");
}

function buildActionEmail({
  actionLabel,
  description,
  eyebrow,
  headline,
  subject,
  url,
}: {
  actionLabel: string;
  description: string;
  eyebrow: string;
  headline: string;
  subject: string;
  url: string;
}) {
  const safeUrl = escapeHtml(url);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeDescription = escapeHtml(description);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeHeadline = escapeHtml(headline);
  const safeSubject = escapeHtml(subject);

  const text = [
    "WAR BRASIL // IDENTIDADE DE COMANDO",
    "",
    headline,
    "",
    description,
    "",
    `${actionLabel}: ${url}`,
    "",
    "O link é válido por 1 hora.",
    "Se você não solicitou esta ação, ignore esta mensagem.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="dark">
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0;background:#070d0a;color:#eee8da;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safeDescription}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#070d0a;">
      <tr>
        <td align="center" style="padding:36px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#101914;border:1px solid #5f4c28;border-radius:18px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.34);">
            <tr>
              <td style="padding:24px 30px;border-bottom:1px solid #3f3520;background:linear-gradient(135deg,#14271c,#0c1510);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td valign="middle">
                      <div style="font-size:10px;font-weight:900;letter-spacing:3px;color:#d0aa57;">WAR BRASIL // IDENTIDADE DE COMANDO</div>
                      <div style="margin-top:8px;font-size:13px;font-weight:700;letter-spacing:1.8px;color:#8fa58f;">PROTOCOLO DE AUTENTICAÇÃO</div>
                    </td>
                    <td width="54" align="right" valign="middle">
                      <div style="width:44px;height:44px;line-height:44px;text-align:center;border:1px solid #d0aa57;color:#d0aa57;font-weight:900;letter-spacing:1px;">WB</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:38px 30px 34px;">
                <div style="font-size:11px;font-weight:900;letter-spacing:2.4px;color:#d0aa57;">${safeEyebrow}</div>
                <h1 style="margin:10px 0 0;font-size:32px;line-height:1.08;color:#f3ead6;letter-spacing:-.7px;">${safeHeadline}</h1>
                <p style="margin:18px 0 0;font-size:16px;line-height:1.75;color:#c9c2b2;">${safeDescription}</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:30px;">
                  <tr>
                    <td align="center">
                      <a href="${safeUrl}" style="display:inline-block;padding:16px 28px;border:1px solid #e0bd6c;border-radius:5px;background:#d0aa57;color:#101913;text-decoration:none;font-size:13px;font-weight:900;letter-spacing:1.6px;box-shadow:0 10px 28px rgba(208,170,87,.16);">${safeActionLabel}</a>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:30px;border-collapse:separate;background:#0b120e;border:1px solid #273429;border-radius:8px;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <div style="font-size:10px;font-weight:900;letter-spacing:1.7px;color:#8fa58f;">PROTOCOLO DE SEGURANÇA</div>
                      <div style="margin-top:7px;font-size:12px;line-height:1.7;color:#9e988b;">O link é válido por 1 hora e só deve ser usado por você. Se você não iniciou esta solicitação, nenhuma ação é necessária.</div>
                    </td>
                  </tr>
                </table>

                <p style="margin:26px 0 0;font-size:12px;line-height:1.7;color:#8d877b;">Se o botão não funcionar, copie e cole este link no navegador:</p>
                <p style="margin:7px 0 0;font-size:11px;line-height:1.6;word-break:break-all;"><a href="${safeUrl}" style="color:#d0aa57;">${safeUrl}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px;border-top:1px solid #273429;background:#0b120e;color:#666f66;font-size:10px;line-height:1.6;letter-spacing:.8px;">
                COMANDO TERRITORIAL // CANAL AUTOMÁTICO DE AUTENTICAÇÃO<br>
                Não responda a esta mensagem.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, subject, text };
}

export function buildVerificationEmail(url: string) {
  return buildActionEmail({
    actionLabel: "CONFIRMAR EMAIL",
    description:
      "Confirme este endereço para ativar sua identidade, concluir o cadastro e liberar o acesso ao Comando do WAR Brasil.",
    eyebrow: "NOVO REGISTRO // VALIDAÇÃO",
    headline: "Bem-vindo ao Comando",
    subject: "Confirme seu email | WAR Brasil",
    url,
  });
}

export function buildPasswordResetEmail(url: string) {
  return buildActionEmail({
    actionLabel: "REDEFINIR SENHA",
    description:
      "Autorize a redefinição de credencial para criar uma nova senha de acesso à sua conta WAR Brasil.",
    eyebrow: "RECUPERAÇÃO // CREDENCIAL",
    headline: "Redefina seu acesso",
    subject: "Redefinição de senha | WAR Brasil",
    url,
  });
}

async function captureAuthEmailForTest(message: AuthEmailMessage) {
  const sinkDirectory = process.env.AUTH_EMAIL_SINK_DIR?.trim();
  if (!sinkDirectory) return false;

  if (process.env.NODE_ENV === "production" && process.env.CI !== "true") {
    throw new Error("AUTH_EMAIL_SINK_DIR é permitido apenas em desenvolvimento/testes.");
  }

  const payload: AuthEmailSinkMessage = {
    ...message,
    capturedAt: new Date().toISOString(),
  };

  await mkdir(sinkDirectory, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}.json`;
  await writeFile(
    path.join(sinkDirectory, filename),
    `${JSON.stringify(payload)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  return true;
}

export function resolveResendTransport(): ResendAuthEmailTransport | null {
  const environment = readAuthServerEnvironment();
  const from = environment.email.from;
  const apiKey = environment.email.transportSecret;

  if (!from || !apiKey) return null;
  return { from, apiKey };
}

async function deliveryIdempotencyKey(message: AuthEmailMessage) {
  const source = new TextEncoder().encode(
    `${message.to}\0${message.subject}\0${message.text}`,
  );
  const digest = await globalThis.crypto.subtle.digest("SHA-256", source);
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `war-auth-${hex}`;
}

async function deliverWithResend(
  message: AuthEmailMessage,
  transport: ResendAuthEmailTransport,
) {
  const idempotencyKey = await deliveryIdempotencyKey(message);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_DELIVERY_TIMEOUT_MS);
  timeout.unref?.();

  try {
    const response = await fetch(RESEND_EMAIL_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${transport.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: transport.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Transportador de email respondeu HTTP ${response.status}.`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendAuthEmail(message: AuthEmailMessage) {
  if (isNonDeliverableAuthAddress(message.to)) {
    return;
  }

  if (await captureAuthEmailForTest(message)) {
    return;
  }

  const transport = resolveResendTransport();
  if (transport) {
    await deliverWithResend(message, transport);
    return;
  }

  if (process.env.NODE_ENV === "production" && process.env.CI !== "true") {
    throw new Error("Transportador de email de autenticação não configurado.");
  }

  console.info(
    `[auth-email] delivery=sink subject=${JSON.stringify(message.subject)}`,
  );
}

export function dispatchAuthEmail(message: AuthEmailMessage) {
  if (isNonDeliverableAuthAddress(message.to)) {
    return;
  }

  after(async () => {
    try {
      await sendAuthEmail(message);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "erro desconhecido";
      console.error(`[auth-email] delivery=failed reason=${reason}`);
    }
  });
}
