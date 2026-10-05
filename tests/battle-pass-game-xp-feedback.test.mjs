import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("private patch aceita somente eventos de XP validados e em lote pequeno", () => {
  const patch = read("src/lib/shared/game-private-patch.ts");
  const event = read(
    "src/lib/shared/progression/battle-pass-game-xp-event.ts",
  );

  assert.match(patch, /battlePassXpEvents\?: BattlePassGameXpEvent\[\]/);
  assert.match(patch, /isBattlePassGameXpEvent/);
  assert.match(patch, /battlePassXpEvents\.length > 8/);
  assert.match(event, /KINDS\.has/);
  assert.match(event, /INTENSITIES\.has/);
  assert.match(event, /row\.xp <= 40_000/);
});

test("eventos privados são despachados sem depender do patch alterar o snapshot", () => {
  const sync = read("src/hooks/use-game-sync.ts");

  const privateBranch = sync.indexOf('event.type === "game.private.patch"');
  const dispatch = sync.indexOf("dispatchBattlePassXpEvents", privateBranch);
  const apply = sync.indexOf("applyRealtimePrivatePatch", privateBranch);

  assert.ok(privateBranch >= 0);
  assert.ok(dispatch > privateBranch);
  assert.ok(apply > dispatch);
});

test("automação publica XP privado pós-commit e não vaza patches no endpoint interno", () => {
  const command = read("src/lib/server/game-command.ts");
  const automation = read("src/lib/server/game-automation-service.ts");
  const internalRoute = read(
    "src/app/api/internal/automation/advance/route.ts",
  );

  const conditionalStart = command.indexOf(
    "export async function gameConditionalCommand",
  );
  const commit = command.indexOf('await client.query("COMMIT")', conditionalStart);
  const publish = command.indexOf(
    "publishCommittedPlayerGamePatch",
    commit,
  );

  assert.ok(commit > conditionalStart);
  assert.ok(publish > commit);
  assert.match(automation, /battlePassXpEvents/);
  assert.doesNotMatch(
    internalRoute,
    /privatePatches|battlePassXpEvents|privatePatch/,
  );
});

test("advance HTTP devolve apenas o private patch do assento autenticado", () => {
  const route = read("src/app/api/games/[roomId]/advance/route.ts");

  assert.match(route, /const seat = await assertAuthenticatedPlayerSeat/);
  assert.match(
    route,
    /result\.privatePatches\?\.find\([\s\S]*delivery\.playerId === seat\.playerId/,
  );
  assert.match(route, /\.\.\.\(privatePatch \? \{ privatePatch \} : \{\}\)/);
});

test("feedback de XP usa uma fila única, dedupe e reduced motion", () => {
  const hook = read("src/hooks/use-game-xp-feedback.ts");
  const css = read(
    "src/components/progression/battle-pass/game-xp-feedback.module.css",
  );
  const component = read(
    "src/components/progression/battle-pass/game-xp-feedback.tsx",
  );
  const layer = read("src/app/game/[roomId]/game-ui-refresh.css");

  assert.match(hook, /seenRef\.current\.has\(event\.id\)/);
  assert.match(hook, /queueRef\.current\.push\(event\)/);
  assert.match(hook, /micro: 1_800/);
  assert.match(hook, /standard: 2_600/);
  assert.match(hook, /major: 3_600/);
  assert.match(hook, /terminal: 4_800/);
  const cinematicCss = read(
    "src/components/dice-3d/battle-dice-cinematic.module.css",
  );

  assert.match(component, /createPortal/);
  assert.match(component, /document\.body/);
  assert.match(layer, /--z-game-modal:\s*81/);
  assert.match(layer, /--z-game-xp-feedback:\s*2147483000/);
  assert.match(layer, /--z-game-cinematic:\s*2147483647/);
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /z-index:\s*2147483000\s*!important/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /contain:\s*layout paint/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(cinematicCss, /z-index:\s*2147483647\s*!important/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /aria-hidden="true"/);
});

test("conclusão e saída reutilizam settlement persistido para feedback terminal", () => {
  const result = read(
    "src/lib/server/progression/battle-pass-match-result-service.ts",
  );
  const victory = read("src/components/game-victory-modal.tsx");
  const exit = read("src/lib/server/game-player-exit-service.ts");
  const game = read("src/components/game-client-v2.tsx");

  assert.match(result, /battlePassSettlementPresentationEvent/);
  assert.match(victory, /result\.presentationEvents/);
  assert.match(victory, /dispatchBattlePassXpEvents/);
  assert.match(exit, /battlePassXpEvent/);
  assert.match(game, /XP DA PARTIDA SALVO|battlePassXpEvent/);
  assert.match(game, /leaveXpFeedbackDelay/);
});


test("XP de combate suspende pela atividade real do cinematic e não pelo stage do snapshot", () => {
  const game = read("src/components/game-client-v2.tsx");
  const overlay = read("src/components/battle-overlay.tsx");

  assert.match(game, /const \[battleCinematicState, setBattleCinematicState\]/);
  assert.match(
    game,
    /suspended:\s*orderCinematicActive \|\| battleCinematicPending/,
  );
  assert.match(
    game,
    /onCinematicStateChange=\{handleBattleCinematicStateChange\}/,
  );
  assert.doesNotMatch(
    game,
    /battleDiceCinematicPending|snapshot\.room\.battle\?\.stage === "show_attacker_result"/,
  );
  assert.match(
    overlay,
    /onCinematicStateChange\?: \(active: boolean\) => void/,
  );
  assert.match(
    overlay,
    /onCinematicStateChange\?\.\(cinematicActive\)/,
  );
  assert.match(
    overlay,
    /onCinematicStateChange\?\.\(false\)/,
  );
});


test("fila de XP preserva eventos positivos durante suspensão sem envolver modais", () => {
  const hook = read("src/hooks/use-game-xp-feedback.ts");
  const game = read("src/components/game-client-v2.tsx");
  const css = read(
    "src/components/progression/battle-pass/game-xp-feedback.module.css",
  );

  assert.match(hook, /if \(event\.xp <= 0 \|\| seenRef\.current\.has\(event\.id\)\) return/);
  assert.match(hook, /queueRef\.current\.push\(event\)/);
  assert.match(
    hook,
    /activeRef\.current \|\|[\s\S]*suspendedRef\.current \|\|[\s\S]*queueRef\.current\.length === 0/,
  );
  assert.match(
    hook,
    /if \(!options\.suspended\)[\s\S]*presentNextRef\.current\(\)/,
  );
  assert.match(
    game,
    /suspended:\s*orderCinematicActive \|\| battleCinematicPending/,
  );
  assert.doesNotMatch(
    game,
    /suspended:[^\n]*(?:leaveConfirmOpen|anomaly\.isOpen|room\.status === "finished")/,
  );
  assert.match(css, /radial-gradient\(/);
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*top:\s*calc\(env\(safe-area-inset-top, 0px\) \+ 88px\)/,
  );
});


test("novo stage de cinematic suspende XP antes do callback do overlay e libera pelo mesmo key", () => {
  const game = read("src/components/game-client-v2.tsx");

  assert.match(
    game,
    /const battleCinematicKey =[\s\S]*?stageStartedAt/,
  );
  assert.match(
    game,
    /battleCinematicState\?\.key !== battleCinematicKey \|\|[\s\S]*battleCinematicState\.active/,
  );
  assert.match(
    game,
    /setBattleCinematicState\(\{ key: battleCinematicKey, active \}\)/,
  );
  assert.match(
    game,
    /suspended:\s*orderCinematicActive \|\| battleCinematicPending/,
  );
});


test("feedback de XP permanece legível por segundos e reduced motion não encurta o conteúdo", () => {
  const hook = read("src/hooks/use-game-xp-feedback.ts");
  const css = read(
    "src/components/progression/battle-pass/game-xp-feedback.module.css",
  );

  assert.match(hook, /micro: 1_800/);
  assert.match(hook, /standard: 2_600/);
  assert.match(hook, /major: 3_600/);
  assert.match(hook, /terminal: 4_800/);
  assert.doesNotMatch(hook, /REDUCED_MOTION_DURATION_MS/);

  assert.match(css, /--xp-feedback-duration:\s*2600ms/);
  assert.match(css, /data-intensity="micro"[\s\S]*--xp-feedback-duration:\s*1800ms/);
  assert.match(css, /data-intensity="major"[\s\S]*--xp-feedback-duration:\s*3600ms/);
  assert.match(css, /data-intensity="terminal"[\s\S]*--xp-feedback-duration:\s*4800ms/);
  assert.match(css, /animation-duration:\s*var\(--xp-feedback-duration\)/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-name:\s*xp-feedback-reduced/,
  );
  assert.doesNotMatch(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:[^;]*800ms/,
  );
});
