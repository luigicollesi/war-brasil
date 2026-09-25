import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDoctrinePresentation,
  DOCTRINE_CHAPTER_SLUGS,
} from "../.test-build/doctrine-presentation.js";

function source(path) {
  return readFileSync(path, "utf8");
}

test("Doutrina cobre o núcleo obrigatório e as mecânicas adicionais ativas", () => {
  const doctrine = buildDoctrinePresentation();
  const slugs = doctrine.chapters.map((chapter) => chapter.slug);

  assert.deepEqual(slugs, [...DOCTRINE_CHAPTER_SLUGS]);
  assert.equal(slugs.length, 13);
  for (const required of [
    "preparacao",
    "trocas",
    "reforcos",
    "ataque",
    "conquista",
    "movimentacao",
    "cartas",
    "objetivos",
    "barreiras-conexoes",
    "anomalias",
    "retirada",
  ]) {
    assert.ok(slugs.includes(required), `${required} precisa existir na Doutrina`);
  }
});

test("read model da Doutrina deriva mecânicas das autoridades do jogo", () => {
  const doctrine = buildDoctrinePresentation();
  const turn = doctrine.chapters.find((chapter) => chapter.slug === "turno");
  const trade = doctrine.chapters.find((chapter) => chapter.slug === "trocas");
  const attack = doctrine.chapters.find((chapter) => chapter.slug === "ataque");
  const barriers = doctrine.chapters.find(
    (chapter) => chapter.slug === "barreiras-conexoes",
  );
  const events = doctrine.chapters.find((chapter) => chapter.slug === "anomalias");
  const departure = doctrine.chapters.find(
    (chapter) => chapter.slug === "retirada",
  );
  const victory = doctrine.chapters.find((chapter) => chapter.slug === "vitoria");

  assert.ok(turn);
  assert.ok(trade);
  assert.ok(attack);
  assert.ok(barriers);
  assert.ok(events);
  assert.ok(departure);
  assert.ok(victory);
  assert.deepEqual(
    turn.metrics.map((phase) => phase.value),
    ["Trocas", "Reforços", "Ataque", "Manobra"],
  );
  assert.equal(trade.visual, "trade");
  assert.equal(doctrine.playerTrade.offerLimitPerTurn, 3);
  assert.equal(doctrine.playerTrade.signalLimitPerTurn, 2);
  assert.equal(doctrine.combatExample.attackerLosses, 1);
  assert.equal(doctrine.combatExample.defenderLosses, 1);
  assert.equal(doctrine.cards.mandatoryTradeHandSize, 5);
  assert.equal(doctrine.cards.ownedTerritoryBonus, 2);
  assert.equal(doctrine.barrier.attackerLossPerComparison, 3);
  assert.equal(doctrine.barrier.maneuverLoss, 1);
  assert.equal(doctrine.barrier.blockedBarrierCount, 2);
  assert.equal(doctrine.conquest.minimumTroopsLeftAtOrigin, 1);
  assert.equal(doctrine.conquest.minimumMove, 1);
  assert.equal(doctrine.maneuver.minimumTroopsLeftAtOrigin, 1);
  assert.equal(doctrine.anomalies.eventCount, 38);
  assert.deepEqual(
    doctrine.objectiveFormats.map((format) => format.title),
    ["DOMÍNIO", "FORTIFICAÇÃO", "ELIMINAÇÃO"],
  );
  assert.match(trade.lede, /Antes dos Reforços/);
  assert.match(trade.principles.join(" "), /Trocar cartas não dá tropas/);
  assert.match(events.lede, /38 anomalias possíveis/);
  assert.equal(departure.visual, "departure");
  assert.equal(departure.number, "12");
  assert.equal(victory.number, "13");
  assert.match(departure.lede, /cartas vão para o descarte/);
  assert.match(
    departure.principles.join(" "),
    /menos territórios.*empate.*aleatoriamente/,
  );
  assert.match(
    departure.principles.join(" "),
    /tropas.*continuam lá[\s\S]*objetivo de todos os jogadores/,
  );
  assert.match(
    departure.principles.join(" "),
    /única situação.*mais de um jogador.*vencer/,
  );

  const presentationSource = source("src/lib/doctrine-presentation.ts");
  assert.match(presentationSource, /buildGameGuidePresentation/);
  assert.match(presentationSource, /guide\.playerTrade\.offerLimitPerTurn/);
  assert.match(presentationSource, /guide\.playerTrade\.signalLimitPerTurn/);
  assert.match(presentationSource, /EVENT_COUNT/);
  assert.match(presentationSource, /JURASSIC_TUNNEL_SOURCE_ID/);
  assert.doesNotMatch(
    presentationSource,
    /const\s+(?:MIN_TERRITORY_TROOPS|MANDATORY_TRADE_HAND_SIZE|OWNED_TERRITORY_CARD_BONUS|PLAYER_TRADE_OFFER_LIMIT|PLAYER_TRADE_SIGNAL_LIMIT)\s*=/,
  );
});

test("/rules resolve deep-link no servidor dentro do runtime Foundation sem depender de Canvas", () => {
  const page = source("src/app/rules/page.tsx");
  const layout = source("src/app/layout.tsx");
  const routes = source(
    "src/components/pre-game/foundation/pre-game-route-intent.ts",
  );

  assert.match(page, /await searchParams/);
  assert.match(page, /isDoctrineChapterSlug/);
  assert.match(page, /buildDoctrinePresentation/);
  assert.match(page, /<DoctrineExperience/);
  assert.match(page, /canonical: "\/rules"/);
  assert.match(
    layout,
    /<PreGameCommandRuntime>\s*<ActiveParticipationRuntime>\{children\}<\/ActiveParticipationRuntime>\s*<\/PreGameCommandRuntime>/,
  );
  assert.match(routes, /"\/rules": "doctrine"/);
  assert.doesNotMatch(page, /<CommandShell|DOCTRINE_SCENE_INTENT/);
  assert.doesNotMatch(page, /Canvas|@react-three|three\//i);
});

test("Doutrina emite somente diretiva visual e deixa mode com a rota", () => {
  const experience = source(
    "src/components/doctrine/doctrine-experience.tsx",
  );

  assert.match(experience, /useCommandSceneDirective/);
  assert.match(experience, /focus: "brazil"/);
  assert.match(experience, /territoryExplode: 0\.18/);
  assert.match(experience, /orbitalAlignment: 0/);
  assert.doesNotMatch(experience, /\bmode\s*:/);
  assert.doesNotMatch(experience, /camera|quaternion|fov|position|\bx:|\by:|\bz:/i);
  assert.doesNotMatch(
    experience,
    /<CommandScene|CameraDirector|from\s+["'][^"']*command-scene["']|@react-three|three\//i,
  );
});

test("índice usa links reais, preserva foco/scroll e anima somente a superfície do capítulo", () => {
  const experience = source(
    "src/components/doctrine/doctrine-experience.tsx",
  );

  assert.match(experience, /`\/rules\?chapter=\$\{slug\}`/);
  assert.match(experience, /window\.history\.pushState/);
  assert.match(experience, /popstate/);
  assert.match(experience, /startViewTransition/);
  assert.match(experience, /prefersReducedMotion/);
  assert.match(experience, /data-chapter=\{chapter\.slug\}/);
  assert.match(experience, /aria-current=\{active \? "location"/);
  assert.match(experience, /aria-label="Regras do jogo"/);
  assert.match(experience, /aria-live="polite"/);
  assert.match(experience, /aria-atomic="true"/);
  assert.match(experience, /Capítulo \{activeChapter\.number\}/);
  assert.match(experience, /ANTERIOR/);
  assert.match(experience, /PRÓXIMO/);
  assert.match(experience, /prefetch=\{false\}/);
  assert.doesNotMatch(experience, /scrollIntoView\s*\(|\bscrollTo\s*\(|\.focus\s*\(/);
  assert.match(experience, /nav\.scrollTop/);
  assert.match(experience, /nav\.scrollLeft/);
});

test("Doutrina oferece retorno persistente ao comando dentro do índice", () => {
  const experience = source(
    "src/components/doctrine/doctrine-experience.tsx",
  );

  assert.match(experience, /className=\{ux\.indexTitleRow\}/);
  assert.match(experience, /className=\{ux\.backButton\}/);
  assert.match(experience, /aria-label="Voltar ao comando"/);
  assert.match(experience, /href="\/home"/);
  assert.match(experience, /VOLTaR/i);
});

test("orquestração cliente permanece pequena e delega as demonstrações", () => {
  const experience = source(
    "src/components/doctrine/doctrine-experience.tsx",
  );

  assert.match(experience, /DoctrineChapterDemo/);
  assert.match(experience, /foundationIntegrated/);
  assert.match(experience, /doctrine-ux-enhancements\.module\.css/);
  assert.doesNotMatch(experience, /DoctrineMark|styles\.topbar|GameDie|GuideBoardScene|TerritoryCardArtwork/);
});

test("demonstrações reutilizam assets reais e explicam negociação sem confundir com resgate", () => {
  const demos = source("src/components/doctrine/doctrine-demo.tsx");

  assert.match(demos, /GuideBoardScene/);
  assert.match(demos, /GuideTradeScene/);
  assert.match(demos, /GameDie/);
  assert.match(demos, /TerritoryCardArtwork/);
  assert.match(demos, /presentation\.playerTrade\.offerLimitPerTurn/);
  assert.match(demos, /presentation\.playerTrade\.signalLimitPerTurn/);
  assert.match(demos, /NEGOCIAÇÃO ≠ RESGATE/);
  assert.match(demos, /presentation\.objectiveFormats/);
  assert.match(demos, /chapter\.metrics/);
  assert.match(demos, /presentation\.conquest/);
  assert.match(demos, /presentation\.maneuver/);
  assert.match(demos, /presentation\.anomalies/);
  assert.match(demos, /case "trade"/);
  assert.match(demos, /<figcaption>/);
  assert.match(demos, /ariaLabel=/);
  assert.doesNotMatch(demos, /const\s+types\s*=|const\s+phases\s*=/);
  assert.doesNotMatch(demos, /Canvas|@react-three|three\//i);
});

test("Doutrina usa um único comando central e fixa navegador e ações no mobile", () => {
  const experience = source(
    "src/components/doctrine/doctrine-experience.tsx",
  );
  const css = source(
    "src/components/doctrine/doctrine-experience.module.css",
  );
  const uxCss = source(
    "src/components/doctrine/doctrine-ux-enhancements.module.css",
  );

  assert.match(experience, /className=\{styles\.commandLink\}/);
  assert.match(experience, /aria-label="Ir ao comando"/);
  assert.match(experience, />\s*COMANDO\s*</);
  assert.doesNotMatch(experience, /mobileReturnButton/);
  assert.match(experience, /<b>\{nextChapter\.title\}<\/b>/);
  assert.match(
    uxCss,
    /@media \(max-width: 760px\)[\s\S]*\.indexPanel\s*\{[\s\S]*bottom: 0/,
  );
  assert.match(
    uxCss,
    /@media \(max-width: 760px\)[\s\S]*\.content\s*\{[\s\S]*padding-bottom:/,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*\.prevNext\s*\{[\s\S]*position: fixed/,
  );
  assert.match(css, /\.commandLink\s*\{/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height: 44px/);
});

test("layout da Doutrina fixa índice no viewport, recompõe mobile e respeita reduced motion", () => {
  const css = source(
    "src/components/doctrine/doctrine-experience.module.css",
  );
  const uxCss = source(
    "src/components/doctrine/doctrine-ux-enhancements.module.css",
  );
  const integrationCss = source(
    "src/components/doctrine/doctrine-foundation-integration.module.css",
  );

  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /\.chapterNav[\s\S]*overflow-x: auto/);
  assert.match(css, /min-height: 44px/);
  assert.match(uxCss, /\.indexPanel\s*\{[\s\S]*position: fixed/);
  assert.match(uxCss, /left: 0/);
  assert.match(uxCss, /top: var\(--command-content-top/);
  assert.match(uxCss, /100dvh/);
  assert.match(uxCss, /margin-left: var\(--doctrine-index-width\)/);
  assert.match(uxCss, /--doctrine-mobile-index-height/);
  assert.match(uxCss, /--doctrine-mobile-actions-height/);
  assert.match(uxCss, /padding-bottom: calc\(/);
  assert.match(uxCss, /overflow-y: auto/);
  assert.match(uxCss, /view-transition-name: doctrine-chapter/);
  assert.match(uxCss, /data-doctrine-direction="forward"/);
  assert.match(uxCss, /data-doctrine-direction="backward"/);
  assert.match(uxCss, /grid-template-columns: repeat\(4/);
  assert.match(uxCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(integrationCss, /rgb\(5 10 8 \/ 68%\)/);
  assert.match(integrationCss, /@media \(max-width: 760px\)/);
  assert.match(integrationCss, /@media \(prefers-reduced-motion: reduce\)/);
});


test("índice desktop limita tipografia e compacta registros sem alterar o índice mobile", () => {
  const uxCss = source(
    "src/components/doctrine/doctrine-ux-enhancements.module.css",
  );

  assert.match(
    uxCss,
    /--doctrine-index-width:\s*clamp\(300px,\s*21vw,\s*360px\)/,
  );
  assert.match(
    uxCss,
    /\.indexTitleRow\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
  assert.match(
    uxCss,
    /\.indexTitleRow \.backButton\s*\{[\s\S]*grid-row:\s*1/,
  );
  assert.match(
    uxCss,
    /\.indexTitleRow h1\s*\{[\s\S]*grid-row:\s*2/,
  );
  assert.match(
    uxCss,
    /\.indexTitleRow h1\s*\{[\s\S]*font-size:\s*clamp\(40px,\s*3vw,\s*50px\)/,
  );
  assert.match(
    uxCss,
    /@media \(min-width: 761px\)[\s\S]*\.chapterNav a\s*\{[\s\S]*min-height:\s*34px/,
  );
  assert.match(
    uxCss,
    /@media \(max-width: 760px\)[\s\S]*\.chapterNav\s*\{[\s\S]*overflow-x:\s*auto/,
  );
});


test("regra de Retirada permanece alinhada ao fluxo autoritativo da partida", () => {
  const departureRules = source("src/lib/shared/game-departure-rules.ts");
  const departureService = source(
    "src/lib/server/game-player-exit-service.ts",
  );
  const victoryService = source("src/lib/server/game-victory-service.ts");

  assert.match(departureRules, /balancedTerritoryAssignments/);
  assert.match(departureRules, /Math\.min\(\.\.\.counts\.values\(\)\)/);
  assert.match(departureRules, /chooseIndex\(candidates\.length\)/);

  assert.match(
    departureService,
    /SET zone='discard',owner_player_id=NULL,deck_order=NULL/,
  );
  assert.match(
    departureService,
    /SET owner_player_id=assignment\.player_id,[\s\S]*moved_in_turn=0/,
  );
  assert.doesNotMatch(
    departureService.slice(
      departureService.indexOf("async function redistributeTerritories"),
      departureService.indexOf("async function normalizeActiveTurnPositions"),
    ),
    /troops\s*=/,
  );
  assert.match(
    departureService,
    /evaluateGameVictories\([\s\S]*candidateIds,[\s\S]*"territory_control_changed"/,
  );
  assert.match(
    departureService,
    /finalizeGameVictories\(client, roomId, objectiveWinners\)/,
  );
  assert.match(victoryService, /game\.room_winners/);
});

test("demonstração de Retirada usa mapa e cartas reais com composição responsiva", () => {
  const demos = source("src/components/doctrine/doctrine-demo.tsx");
  const uxCss = source(
    "src/components/doctrine/doctrine-ux-enhancements.module.css",
  );

  assert.match(demos, /TerritoryCardArtwork/);
  assert.match(demos, /GuideBoardScene/);
  assert.match(demos, /departureCardTransfer/);
  assert.match(demos, /departureWinnerPair/);
  assert.match(demos, /JOGADOR SAI DA PARTIDA/);
  assert.match(uxCss, /\.departureStage\s*\{/);
  assert.match(uxCss, /\.departureTopFlow\s*\{/);
  assert.match(uxCss, /\.departureLowerFlow\s*\{/);
  assert.match(uxCss, /\.departureVictoryBanner\s*\{/);
  assert.match(
    uxCss,
    /@media \(max-width: 760px\)[\s\S]*\.departureTopFlow,[\s\S]*\.departureLowerFlow/,
  );
  assert.match(
    uxCss,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.departureScanLine::after/,
  );
});


test("Doutrina restringe dourado oliva a detalhes e não preenche superfícies de destaque", () => {
  const css = source(
    "src/components/doctrine/doctrine-experience.module.css",
  );
  const uxCss = source(
    "src/components/doctrine/doctrine-ux-enhancements.module.css",
  );

  const viewportAfter = css.slice(
    css.indexOf(".demoViewport::after"),
    css.indexOf(".demoFrame figcaption"),
  );
  assert.match(viewportAfter, /44px 1px no-repeat/);
  assert.match(viewportAfter, /1px 44px no-repeat/);
  assert.doesNotMatch(viewportAfter, /clip-path/);
  assert.doesNotMatch(
    viewportAfter,
    /background:\s*rgba\(205,\s*180,\s*107,\s*0\.35\)/,
  );

  const departureFrame = uxCss.slice(
    uxCss.indexOf(".departureStage::before"),
    uxCss.indexOf(".departureProtocol"),
  );
  assert.match(departureFrame, /36px 1px no-repeat/);
  assert.match(departureFrame, /1px 36px no-repeat/);
  assert.doesNotMatch(departureFrame, /clip-path/);
  assert.doesNotMatch(
    departureFrame,
    /background:\s*rgba\(205,\s*180,\s*107/,
  );

  assert.match(
    css,
    /\.phaseStep[\s\S]*rgba\(72, 110, 85, 0\.07\)/,
  );
  assert.match(
    css,
    /\.reinforcementReadout[\s\S]*background:\s*rgba\(9, 16, 13, 0\.92\)/,
  );
  assert.match(
    uxCss,
    /\.departureVictoryStep[\s\S]*rgba\(72, 110, 85, 0\.1\)/,
  );
});


test("demonstrações táticas usam layouts adequados ao tipo de informação", () => {
  const demos = source("src/components/doctrine/doctrine-demo.tsx");
  const uxCss = source(
    "src/components/doctrine/doctrine-ux-enhancements.module.css",
  );

  assert.match(demos, /machineSceneRail/);
  assert.match(demos, /machineSceneSplit/);
  assert.match(demos, /machineSceneCentered/);
  assert.match(demos, /machineSceneOverlay/);
  assert.match(demos, /sceneBoard/);
  assert.match(demos, /sceneAside/);
  assert.match(demos, /ATAQUE PELA BARREIRA/);

  assert.match(
    uxCss,
    /\.machineSceneRail\s*\{[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    uxCss,
    /@media \(max-width: 1312px\)[\s\S]*\.machineSceneRail[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    uxCss,
    /@media \(max-width: 1180px\)[\s\S]*\.machineSceneSplit,[\s\S]*grid-template-columns:\s*1fr/,
  );
  assert.match(
    uxCss,
    /@media \(max-width: 760px\)[\s\S]*\.machineSceneRail[\s\S]*grid-template-columns:\s*1fr/,
  );
});

test("mapas de ataque, conquista, manobra e barreira mantêm overlays separados", () => {
  const demos = source("src/components/doctrine/doctrine-demo.tsx");
  const uxCss = source(
    "src/components/doctrine/doctrine-ux-enhancements.module.css",
  );

  assert.match(demos, /attack-origin[\s\S]*x: 35/);
  assert.match(demos, /conquest-origin[\s\S]*x: 34/);
  assert.match(demos, /move-origin[\s\S]*x: 33/);
  assert.match(demos, /barrier-origin[\s\S]*x: 34/);
  assert.match(
    uxCss,
    /\.maneuverScene[\s\S]*\.wb-guide-board-scene-marker em/,
  );
  assert.match(
    uxCss,
    /\.barrierBandsRefined\s*\{[\s\S]*background:\s*transparent/,
  );
});

test("redistribuição da Retirada reduz densidade de labels sobre o mapa", () => {
  const demos = source("src/components/doctrine/doctrine-demo.tsx");
  const uxCss = source(
    "src/components/doctrine/doctrine-ux-enhancements.module.css",
  );

  const departureStart = demos.indexOf("function DepartureDemo");
  const departureEnd = demos.indexOf("function VictoryDemo", departureStart);
  const departure = demos.slice(departureStart, departureEnd);

  assert.equal((departure.match(/label: "ATRIBUIR"/g) ?? []).length, 1);
  assert.match(departure, /departure-a[\s\S]*x: 27[\s\S]*y: 32/);
  assert.match(departure, /departure-b[\s\S]*x: 73[\s\S]*y: 67/);
  assert.match(
    uxCss,
    /\.departureMap :global\(\.wb-guide-board-scene-marker\)[\s\S]*min-width:\s*72px/,
  );
});


test("textos visíveis da Doutrina explicam regras sem vocabulário de implementação", () => {
  const presentation = source("src/lib/doctrine-presentation.ts");
  const demos = source("src/components/doctrine/doctrine-demo.tsx");
  const experience = source("src/components/doctrine/doctrine-experience.tsx");
  const visibleCopy = [presentation, demos, experience].join("\n");

  for (const forbidden of [
    "estado autoritativo",
    "origem autoritativa",
    "engine",
    "topologia vigente",
    "grafo ponderado",
    "build atual",
    "demonstração da máquina",
    "regra operacional",
    "protocolos operacionais",
  ]) {
    assert.doesNotMatch(
      visibleCopy,
      new RegExp(forbidden, "i"),
      `texto técnico exposto: ${forbidden}`,
    );
  }

  assert.match(experience, /COMO JOGAR/);
  assert.match(experience, /EXEMPLO DA REGRA/);
  assert.match(presentation, /Seu turno acontece em quatro fases/);
  assert.match(presentation, /Você vence quando completa seu objetivo/);
  assert.match(presentation, /Essa é a única situação em que mais de um jogador pode vencer ao mesmo tempo/);
});
