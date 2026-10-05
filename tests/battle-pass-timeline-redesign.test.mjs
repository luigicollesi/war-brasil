import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const page = read(
  "src/components/progression/battle-pass/battle-pass-page.tsx",
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
const rewardCss = read(
  "src/components/progression/battle-pass/battle-pass-reward.module.css",
);
const pageCss = read(
  "src/components/progression/battle-pass/battle-pass-page.module.css",
);

test("Campanha renderiza os 100 níveis em uma única timeline contínua", () => {
  assert.match(page, /levels=\{snapshot\.levels\}/);
  assert.match(timeline, /levels\.map/);
  assert.doesNotMatch(page, /railStart|visibleLevels|maxRailStart/);
  assert.doesNotMatch(page, /showPreviousLevels|showNextLevels/);
  assert.doesNotMatch(page, /PRÓXIMOS →|← ANTERIORES/);
});

test("desktop usa scroll horizontal com Elite acima e Livre abaixo", () => {
  const premium = timeline.indexOf("className={styles.premiumZone}");
  const axis = timeline.indexOf("className={styles.axisCell}");
  const free = timeline.indexOf("className={styles.freeZone}");

  assert.ok(premium >= 0 && axis > premium && free > axis);
  assert.match(timelineCss, /\.viewport\s*\{[\s\S]*overflow-x:\s*auto/);
  assert.match(timelineCss, /grid-auto-flow:\s*column/);
  assert.match(
    timelineCss,
    /grid-template-rows:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/,
  );
});

test("mobile gira a timeline para vertical com Elite à esquerda e Livre à direita", () => {
  const mobileStart = timelineCss.indexOf("@media (max-width: 760px)");
  const mobileEnd = timelineCss.indexOf("@media (max-width: 390px)", mobileStart);
  const mobile = timelineCss.slice(
    mobileStart,
    mobileEnd > mobileStart ? mobileEnd : timelineCss.length,
  );

  assert.match(mobile, /overflow-x:\s*hidden/);
  assert.match(mobile, /overflow-y:\s*auto/);
  assert.match(
    mobile,
    /grid-template-columns:\s*minmax\(0, 1fr\) 54px minmax\(0, 1fr\)/,
  );
  assert.match(mobile, /\.premiumZone[\s\S]*grid-column:\s*1/);
  assert.match(mobile, /\.axisCell[\s\S]*grid-column:\s*2/);
  assert.match(mobile, /\.freeZone[\s\S]*grid-column:\s*3/);
});

test("nível atual usa navegação direta sem estado de scroll em React", () => {
  assert.match(timeline, /scrollIntoView/);
  assert.match(timeline, /NÍVEL ATUAL/);
  assert.match(timeline, /requestAnimationFrame/);
  assert.doesNotMatch(timeline, /addEventListener\(["']scroll/);
});

test("recompensas bloqueadas continuam legíveis sem perder hierarquia", () => {
  assert.doesNotMatch(page, /RewardCard|RewardGroupCard/);
  assert.match(reward, /BattlePassReward/);
  assert.match(reward, /BattlePassRewardGroup/);
  assert.match(rewardCss, /\.rewardItem\s*\{[\s\S]*background:\s*transparent/);
  assert.match(
    rewardCss,
    /\.rewardItem\[data-state="locked"\],[\s\S]*?\.rewardItem\[data-state="premium_locked"\]\s*\{\s*opacity:\s*\.62;/,
  );
  assert.doesNotMatch(rewardCss, /\.rewardItem\s*\{[\s\S]*?border:\s*1px/);
  assert.match(pageCss, /\.premiumConfirmation\s*\{[\s\S]*border:\s*1px/);
  assert.match(pageCss, /\.rewardRevealCard\s*\{[\s\S]*border:\s*1px/);
});

test("desktop desenha um único eixo contínuo independente da altura das recompensas", () => {
  const mobileStart = timelineCss.indexOf("@media (max-width: 760px)");
  const desktop = timelineCss.slice(0, mobileStart);

  assert.match(desktop, /\.rail::before\s*\{/);
  assert.match(desktop, /top:\s*50%/);
  assert.match(desktop, /\.levelNode\s*\{[\s\S]*height:\s*480px/);
  assert.match(
    desktop,
    /grid-template-rows:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/,
  );
  assert.match(
    desktop,
    /\.axisCell\s*\{[\s\S]*position:\s*absolute[\s\S]*top:\s*50%/,
  );
  assert.doesNotMatch(desktop, /\.axisCell::before/);
});

test("Campanha usa fundo Foundation e preserva reduced motion", () => {
  assert.match(pageCss, /\.surface\s*\{[\s\S]*background:\s*transparent/);
  assert.match(pageCss, /var\(--command-content-top/);
  assert.match(pageCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(timelineCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(
    `${page}\n${timeline}\n${reward}`,
    /@react-three\/fiber|from "three"|<Canvas\b|<CommandShell\b/,
  );
});
