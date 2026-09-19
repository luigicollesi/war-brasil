import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync(
  "src/components/auth/command-auth-modal.tsx",
  "utf8",
);

test("verification exibe OTP e cooldown regressivo real", () => {
  assert.match(modal, /RESEND_COOLDOWN_SECONDS = 60/);
  assert.match(modal, /const \[resendSecondsRemaining, setResendSecondsRemaining\] = useState\(0\)/);
  assert.match(modal, /window\.setInterval/);
  assert.match(modal, /Math\.max\(0, current - 1\)/);
  assert.match(modal, /autoComplete="one-time-code"/);
  assert.match(modal, /pattern="\[0-9\]\{6\}"/);
  assert.match(modal, /NOVO CÓDIGO EM \$\{resendSecondsRemaining\} S/);
  assert.match(modal, /O código é válido por 10 minutos/);
});

test("confirmação e reenvio usam endpoints próprios do pending registration", () => {
  assert.match(modal, /fetch\("\/api\/auth\/register\/verify"/);
  assert.match(modal, /fetch\("\/api\/auth\/register\/resend"/);
  assert.match(modal, /await onAuthenticated\(\)/);
  assert.doesNotMatch(modal, /sendVerificationEmail/);
});

test("resend e forgot-password mantêm resposta pública não-enumerável", () => {
  assert.match(
    modal,
    /Se existir um cadastro pendente para esse endereço, enviaremos um novo código\./,
  );
  assert.match(
    modal,
    /Se existir uma conta para esse endereço, enviaremos as instruções de redefinição\./,
  );
  assert.doesNotMatch(modal, /conta não existe|email não cadastrado|usuário não encontrado/i);
});
