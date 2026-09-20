import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const REGISTRATION_EMAIL_SUBJECT =
  "Seu código de confirmação | WAR Brasil";

export async function waitForRegistrationCode(
  email,
  sinkDirectory,
  timeoutMs = 10_000,
) {
  assert.ok(sinkDirectory, "AUTH_EMAIL_SINK_DIR é obrigatório para capturar OTP.");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const entries = await readdir(sinkDirectory).catch(() => []);
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const raw = await readFile(path.join(sinkDirectory, entry), "utf8").catch(
        () => null,
      );
      if (!raw) continue;

      try {
        const message = JSON.parse(raw);
        if (
          message?.to !== email ||
          message?.subject !== REGISTRATION_EMAIL_SUBJECT
        ) {
          continue;
        }

        const match = String(message?.text ?? "").match(
          /Código de confirmação:\s*(\d{6})/i,
        );
        assert.ok(match?.[1], "email de cadastro não contém OTP de 6 dígitos");
        return match[1];
      } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`OTP de cadastro não capturado para ${email}`);
}
