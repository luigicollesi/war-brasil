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
  const timeline = read(
    "src/components/progression/battle-pass/battle-pass-timeline.tsx",
  );
  const timelineCss = read(
    "src/components/progression/battle-pass/battle-pass-timeline.module.css",
  );
  const reward = read(
    "src/components/progression/battle-pass/battle-pass-reward.tsx",
  );
  const server = read(
    "src/lib/server/progression/battle-pass-snapshot-service.ts",
  );

  assert.match(page, /COLETAR TODAS/);
  assert.match(page, /<BattlePassTimeline/);
  assert.match(timeline, /TRILHA DE ELITE/);
  assert.match(timeline, /TRILHA LIVRE/);
  assert.match(timeline, /NÍVEL ATUAL/);
  assert.match(timeline, /levels\.map/);
  assert.doesNotMatch(page, /railStart|visibleLevels|PRÓXIMOS →|← ANTERIORES/);
  assert.match(reward, /BattlePassRewardGroup/);
  assert.match(page, /rewardRevealBackdrop/);
  assert.match(page, /\/api\/battle-pass\/rewards\/claim/);
  assert.match(css, /overflow-x: clip/);
  assert.match(timelineCss, /overflow-x:\s*auto/);
  assert.match(timelineCss, /@media \(max-width: 760px\)/);
  assert.match(timelineCss, /overflow-y:\s*auto/);
  assert.match(css, /@keyframes rewardClaimEnter/);
  assert.match(css, /\.rewardRevealBackdrop/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(server, /progression\.battle_pass_reward_claims/);
  assert.match(server, /deriveBattlePassRewardState/);
  assert.doesNotMatch(page, /creditAmount:\s*\d+/);
});


test("nível 100 recebe apresentação de conclusão após claim confirmado", () => {
  const page = read(
    "src/components/progression/battle-pass/battle-pass-page.tsx",
  );

  assert.match(page, /CAMPANHA CONCLUÍDA/);
  assert.match(page, /claimReveal\.reward\.level === 100/);
  assert.match(page, /claimReveal\.reward\.kind === "commander_title"/);
  assert.match(page, /level100Titles/);
  assert.match(page, /TRILHA DE ELITE/);
  assert.match(page, /TRILHA LIVRE/);
});


test("timeline usa eixo horizontal no desktop e vertical no mobile", () => {
  const timeline = read(
    "src/components/progression/battle-pass/battle-pass-timeline.tsx",
  );
  const css = read(
    "src/components/progression/battle-pass/battle-pass-timeline.module.css",
  );

  assert.match(timeline, /levels\.map/);
  assert.match(timeline, /scrollIntoView/);
  assert.match(css, /grid-auto-flow:\s*column/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 54px minmax\(0, 1fr\)/,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*overflow-y:\s*auto/,
  );
});


test("dialog de recompensa prende e restaura foco com Escape", () => {
  const page = read(
    "src/components/progression/battle-pass/battle-pass-page.tsx",
  );

  assert.match(page, /rewardDialogRef/);
  assert.match(page, /rewardDialogCloseRef/);
  assert.match(page, /rewardDialogReturnFocusRef/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(page, /event\.key !== "Tab"/);
  assert.match(page, /rewardDialogCloseRef\.current\?\.focus\(\)/);
  assert.match(page, /rewardDialogReturnFocusRef\.current\?\.focus\(\)/);
  assert.match(page, /aria-modal="true"/);
});


test("Home diferencia campanha encerrada sem esconder rewards pendentes", () => {
  const home = read("src/components/pre-game/home/command-home-client.tsx");
  const presentation = read(
    "src/lib/shared/progression/battle-pass-presentation.ts",
  );
  const snapshot = read(
    "src/lib/server/progression/battle-pass-snapshot-service.ts",
  );

  assert.match(presentation, /seasonStatus: "active" \| "ended"/);
  assert.match(snapshot, /seasonStatus: season\.status/);
  assert.match(home, /initialCampaign\.seasonStatus === "ended"/);
  assert.match(home, /CAMPANHA ENCERRADA/);
  assert.match(home, /PARA COLETAR/);
});


test("season encerrada vira período de coleta sem CTA Elite", () => {
  const page = read(
    "src/components/progression/battle-pass/battle-pass-page.tsx",
  );

  assert.match(page, /snapshot\.season\.status === "active" \? "ATIVA" : "ENCERRADA"/);
  assert.match(page, /COLETA ATÉ/);
  assert.match(page, /A ativação da Trilha de Elite foi encerrada/);
  assert.match(page, /snapshot\.season\.status === "ended"/);
});
