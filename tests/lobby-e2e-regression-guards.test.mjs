import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const syncSource = readFileSync("src/hooks/use-lobby-sync.ts", "utf8");
const backButtonCss = readFileSync(
  "src/components/pre-game-back-button.module.css",
  "utf8",
);

test("lobby sync interrompe polling automático para erros terminais de sessão/assento", () => {
  assert.match(syncSource, /TERMINAL_SYNC_STATUSES\s*=\s*new Set\(\[401, 403, 404\]\)/);
  assert.match(syncSource, /TERMINAL_SYNC_STATUSES\.has\(response\.status\)/);
  assert.match(syncSource, /pollingStopped\s*=\s*true/);
  assert.match(syncSource, /if \(isActive && !pollingStopped\)/);
});

test("navegação mobile não consome a coluna central da lobby", () => {
  assert.match(backButtonCss, /@media \(max-width: 640px\)/);
  assert.match(backButtonCss, /\.button > span:not\(\.icon\)\s*\{\s*display: none;/s);
  assert.match(backButtonCss, /width: 42px;/);
});
