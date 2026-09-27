import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("/home expõe Campanha como quarto destino sem perder navegação por teclado", () => {
  const home = read("src/components/pre-game/home/command-home-client.tsx");
  const intent = read(
    "src/components/pre-game/home/command-home-scene-intent.ts",
  );
  const css = read(
    "src/components/pre-game/home/command-home.module.css",
  );

  assert.match(home, /id: "campaign"/);
  assert.match(home, /href: "\/campaign"/);
  assert.match(home, /index: "04"/);
  assert.match(home, /label: "CAMPANHA"/);
  assert.match(intent, /"campaign"/);
  assert.match(css, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*grid-template-columns: 1fr/);
  assert.match(home, /onFocus=/);
});

test("/campaign usa snapshot autoritativo, claims e reduced motion", () => {
  const page = read(
    "src/components/progression/battle-pass/battle-pass-page.tsx",
  );
  const css = read(
    "src/components/progression/battle-pass/battle-pass-page.module.css",
  );
  const server = read(
    "src/lib/server/progression/battle-pass-snapshot-service.ts",
  );

  assert.match(page, /TRILHA DE ELITE/);
  assert.match(page, /TRILHA LIVRE/);
  assert.match(page, /COLETAR TODAS/);
  assert.match(page, /\/api\/battle-pass\/rewards\/claim/);
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(server, /progression\.battle_pass_reward_claims/);
  assert.match(server, /deriveBattlePassRewardState/);
  assert.doesNotMatch(page, /creditAmount:\s*\d+/);
});
