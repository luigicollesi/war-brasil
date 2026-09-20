import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const modalSource = await readFile(
  "src/components/auth/command-auth-modal.tsx",
  "utf8",
);

test("reset de senha revoga servidor e limpa imediatamente o cache de sessão client", () => {
  const resetStart = modalSource.indexOf("const submitResetPassword");
  const resetEnd = modalSource.indexOf("\n  return (", resetStart);
  assert.ok(resetStart >= 0 && resetEnd > resetStart, "handler de reset não encontrado");

  const resetHandler = modalSource.slice(resetStart, resetEnd);
  assert.match(resetHandler, /authClient\.resetPassword\(/);
  assert.match(resetHandler, /await authClient\.signOut\(\)/);
  assert.ok(
    resetHandler.indexOf("authClient.resetPassword(") <
      resetHandler.indexOf("await authClient.signOut()"),
    "sign-out client precisa ocorrer somente após o reset ser aceito",
  );
  assert.match(resetHandler, /setMode\("login"\)/);
});
