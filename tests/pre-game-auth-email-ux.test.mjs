import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync(
  "src/components/auth/command-auth-modal.tsx",
  "utf8",
);

test("verification inicia e reaplica cooldown visual de reenvio", () => {
  assert.match(modal, /RESEND_COOLDOWN_MS = 60_000/);
  assert.match(modal, /setResendCoolingDown\(true\)/);
  assert.match(modal, /disabled=\{isPending \|\| resendCoolingDown\}/);
  assert.match(modal, /REENVIO DISPONÍVEL EM 60 S/);
});

test("resend e forgot-password mantêm resposta pública não-enumerável", () => {
  assert.match(
    modal,
    /Se existir uma conta pendente para esse endereço, enviaremos um novo link\./,
  );
  assert.match(
    modal,
    /Se existir uma conta para esse endereço, enviaremos as instruções de redefinição\./,
  );
  assert.match(modal, /error\?\.status === 429/);
  assert.doesNotMatch(modal, /conta não existe|email não cadastrado|usuário não encontrado/i);
});
