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
  assert.match(
    modal,
    /fetchJsonWithTimeout<VerificationResponse>\(\s*"\/api\/auth\/register\/verify"/,
  );
  assert.match(
    modal,
    /fetchJsonWithTimeout<RegisterResponse>\(\s*"\/api\/auth\/register\/resend"/,
  );
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


test("auth modal não usa async Transition como mutex de requests", () => {
  assert.doesNotMatch(modal, /useTransition|startTransition/);
  assert.match(modal, /AUTH_REQUEST_TIMEOUT_MS = 15_000/);
  assert.match(modal, /AbortController/);
  assert.match(modal, /setPendingAction\(action\)/);
  assert.match(modal, /finally \{[\s\S]*setPendingAction\(null\)/);
});

test("cadastro recupera UI mesmo se a resposta HTTP travar após o envio", () => {
  assert.match(modal, /fetchJsonWithTimeout<RegisterResponse>/);
  assert.match(modal, /error instanceof DOMException && error\.name === "AbortError"/);
  assert.match(modal, /setMode\("verification"\)/);
  assert.match(
    modal,
    /O envio foi iniciado, mas a resposta demorou\. Se você recebeu o código, digite-o abaixo\./,
  );
});
