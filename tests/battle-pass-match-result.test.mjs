import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("resultado pós-partida reconstrói XP somente do ledger autoritativo", () => {
  const service = read(
    "src/lib/server/progression/battle-pass-match-result-service.ts",
  );

  assert.match(service, /FROM game\.matches match/);
  assert.match(service, /JOIN game\.match_participants participant/);
  assert.match(service, /progression\.battle_pass_xp_entries/);
  assert.match(service, /history\.id <= awarded\.entry_id/);
  assert.match(service, /resolveBattlePassLevel/);
  assert.doesNotMatch(service, /INSERT|UPDATE progression\.battle_pass/);
});

test("endpoint de resultado exige sessão autenticada e não aceita XP do cliente", () => {
  const route = read(
    "src/app/api/games/[roomId]/battle-pass-result/route.ts",
  );

  assert.match(route, /getAuthenticatedSessionForRead/);
  assert.match(route, /getBattlePassMatchResult\(roomId, session\.user\.id\)/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /export async function POST/);
});

test("modal terminal exibe XP e avanço de nível sem recalcular regra de progressão", () => {
  const modal = read("src/components/game-victory-modal.tsx");
  const css = read("src/app/game/[roomId]/game-fine-tuning.css");

  assert.match(modal, /\/battle-pass-result/);
  assert.match(modal, /battlePassResult\.xpGranted/);
  assert.match(modal, /battlePassResult\.levelBefore/);
  assert.match(modal, /battlePassResult\.levelAfter/);
  assert.match(modal, /battlePassResult\.breakdown\.actionXp/);
  assert.match(modal, /battlePassResult\.breakdown\.completionXp/);
  assert.match(modal, /battlePassResult\.breakdown\.victoryBonusXp/);
  assert.match(modal, /battlePassResult\.breakdown\.multiplierBps/);
  assert.match(css, /\.victory-battle-pass-status/);
  assert.doesNotMatch(modal, /completionXp\s*\+\s*victoryBonusXp/);
});
