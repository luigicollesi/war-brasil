import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { after } from "next/server";

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
  subject,
  url,
}: {
  actionLabel: string;
  description: string;
  subject: string;
  url: string;
}) {
  const safeUrl = escapeHtml(url);
  const text = [
    "WAR-BRASIL",
    "",
    description,
    "",
    url,
    "",
    "O link é válido por 1 hora.",
    "Se você não solicitou esta ação, ignore esta mensagem.",
  ].join("\n");
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
  </head>
  <body style="margin:0;background:#101512;color:#efe4c9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#101512;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border-collapse:separate;background:#182019;border:1px solid #92733b;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:22px 28px;border-bottom:1px solid #92733b;background:#111713;">
                <div style="font-size:11px;font-weight:800;letter-spacing:3px;color:#c5a45c;">WAR-BRASIL</div>
                <div style="margin-top:8px;font-size:24px;font-weight:800;color:#efe4c9;">${escapeHtml(subject)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 28px;">
                <p style="margin:0;font-size:16px;line-height:1.7;color:#d8d1c1;">${escapeHtml(description)}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                  <tr>
                    <td>
                      <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border-radius:4px;background:#c5a45c;color:#111713;text-decoration:none;font-size:13px;font-weight:900;letter-spacing:1.5px;">${escapeHtml(actionLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:28px 0 0;font-size:13px;line-height:1.7;color:#a9a293;">Se o botão não funcionar, copie e cole este link no navegador:</p>
                <p style="margin:8px 0 0;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${safeUrl}" style="color:#d3b66e;">${safeUrl}</a></p>
                <p style="margin:24px 0 0;font-size:12px;line-height:1.7;color:#8f897d;">O link é válido por 1 hora. Se você não solicitou esta ação, ignore esta mensagem.</p>
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
    actionLabel: "VERIFICAR EMAIL",
    description: "Confirme seu email para liberar sua identidade de Comando.",
    subject: "Verificação de email",
    url,
  });
}

export function buildPasswordResetEmail(url: string) {
  return buildActionEmail({
    actionLabel: "REDEFINIR SENHA",
    description: "Use este link para definir uma nova senha para sua conta War-Brasil.",
    subject: "Redefinição de senha",
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

function productionTransportConfig() {
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  const apiKey = process.env.EMAIL_TRANSPORT_SECRET?.trim();
  if (!from || !apiKey) {
    throw new Error("Transportador de email de autenticação não configurado.");
  }
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

async function deliverWithResend(message: AuthEmailMessage) {
  const { from, apiKey } = productionTransportConfig();
  const idempotencyKey = await deliveryIdempotencyKey(message);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_DELIVERY_TIMEOUT_MS);
  timeout.unref?.();

  try {
    const response = await fetch(RESEND_EMAIL_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from,
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

  if (process.env.CI === "true" || process.env.NODE_ENV !== "production") {
    console.info(
      `[auth-email] delivery=sink subject=${JSON.stringify(message.subject)}`,
    );
    return;
  }

  await deliverWithResend(message);
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
