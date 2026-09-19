import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync(
  "src/components/auth/command-auth-modal.tsx",
  "utf8",
);

test("verification exibe cooldown regressivo real de 60 a 0 segundos", () => {
  assert.match(modal, /RESEND_COOLDOWN_SECONDS = 60/);
  assert.match(modal, /const \[resendSecondsRemaining, setResendSecondsRemaining\] = useState\(0\)/);
  assert.match(modal, /window\.setInterval/);
  assert.match(modal, /Math\.max\(0, current - 1\)/);
  assert.match(modal, /setResendSecondsRemaining\(RESEND_COOLDOWN_SECONDS\)/);
  assert.match(modal, /disabled=\{isPending \|\| resendSecondsRemaining > 0\}/);
  assert.match(modal, /REENVIO DISPONÍVEL EM \$\{resendSecondsRemaining\} S/);
  assert.doesNotMatch(modal, /REENVIO DISPONÍVEL EM 60 S/);
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
